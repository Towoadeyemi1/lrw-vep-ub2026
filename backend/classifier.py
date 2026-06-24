"""
Three-tier invoice classification pipeline.

Tier 1 — Vendor lookup (instant, deterministic):
    If the vendor has been confirmed before and has auto_route status,
    route immediately.

Tier 2 — Signal scoring (fast, rule-based):
    Score each entity using vendor category, entity name mentions,
    address patterns, PO format, and amount range.  If top score >= 0.80,
    route automatically.

Tier 3 — Claude AI classification (slow, high-accuracy):
    Feed extracted data + top-N candidates to claude-sonnet-4-6 for
    reasoning-based routing.  If confidence < 0.65, send to human review.
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any, Optional

import anthropic

from extractor import InvoiceFile

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-6"

# Confidence thresholds
TIER2_AUTO_THRESHOLD = 0.80
TIER3_AUTO_THRESHOLD = 0.75
TIER3_REVIEW_THRESHOLD = 0.55  # below this → human review

# ─── Prompts ──────────────────────────────────────────────────────────────────

EXTRACTION_PROMPT = """You are an expert invoice data extraction specialist for a multi-entity business portfolio spanning hospitality, real estate, and wellness.

Extract ALL routing-relevant information from this invoice with maximum precision.

Return ONLY a valid JSON object with these exact fields:
{
  "vendor_name_raw": "exact vendor name as it appears on the invoice",
  "vendor_name_variants": ["all name variations found anywhere in document"],
  "vendor_canonical": "your best normalised lowercase version",
  "vendor_category": "ONE of: Food Service|Commercial Linen|HVAC|Cleaning|Security|Landscaping|Property Maintenance|Spa Supplies|Health Supplements|Packaging|IT Services|Legal Services|Construction|AV Equipment|Electrical|Plumbing|Elevator Services|Event Supplies|Fitness Equipment|Floral|Catering|Uniforms|Pest Control|Pool Maintenance|Window Cleaning|Photography|Digital Marketing|Web Services|Accounting|Insurance|Environmental|Survey|Architecture|Engineering|Retail Fixtures|POS Systems|Shipping Supplies|Organic Products|Aromatherapy|Essential Oils|Other",
  "vendor_category_confidence": "high|medium|low",
  "billing_address": "complete billing address",
  "remittance_address": "remittance address if different from billing",
  "invoice_number": "invoice or reference number",
  "invoice_date": "YYYY-MM-DD or as found",
  "due_date": "YYYY-MM-DD or null",
  "total_amount": 0.00,
  "subtotal": 0.00,
  "tax_amount": 0.00,
  "currency": "USD|CAD|EUR|GBP",
  "line_items": ["brief description of each line item"],
  "po_number": "PO number if present or null",
  "cost_centre": "cost centre code if present or null",
  "entity_mentions": ["any specific business entity names mentioned anywhere"],
  "property_addresses": ["any delivery or property addresses that identify the destination"],
  "payment_terms": "payment terms if stated",
  "bank_details": "payment/bank details if present",
  "field_confidence": {
    "vendor_name": "high|medium|low",
    "amount": "high|medium|low",
    "entity_signals": "high|medium|low",
    "invoice_number": "high|medium|low"
  },
  "routing_notes": "any observations that would help determine which business entity this belongs to"
}

Return ONLY the JSON. No markdown. No explanation. No preamble."""

CLASSIFICATION_PROMPT = """You are an invoice routing specialist for a company with 12 business entities across hospitality, real estate, and wellness.

INVOICE EXTRACTED DATA:
{extracted_json}

TOP CANDIDATE ENTITIES (by signal score):
{candidates_json}

Analyse the invoice carefully. Consider: vendor type and category, service description, amounts, addresses, entity name mentions, and industry context.

Determine which entity this invoice most likely belongs to.

Return ONLY valid JSON:
{{
  "entity_id": "entity_XX",
  "entity_name": "full entity name",
  "confidence": 0.00,
  "reasoning": "2-3 sentence explanation of why this entity was selected over others",
  "signals_used": ["specific signals that drove this decision"],
  "alternative_entity_id": "entity_XX or null if no close second",
  "alternative_confidence": 0.00
}}"""


# ─── Tier 2 scoring ───────────────────────────────────────────────────────────


def score_entity(extracted: dict, entity: dict) -> tuple[float, list[str]]:
    """
    Score how well an extracted invoice matches a given entity.
    Returns (score 0–1, list of matched signal descriptions).
    """
    score = 0.0
    reasons: list[str] = []

    vendor_cats: list[str] = entity.get("known_vendor_categories", [])
    extracted_cat: str = extracted.get("vendor_category", "")

    if extracted_cat and any(
        extracted_cat.lower() in cat.lower() or cat.lower() in extracted_cat.lower()
        for cat in vendor_cats
    ):
        score += 0.35
        reasons.append(f"Category match: {extracted_cat}")

    entity_name_lower = entity["name"].lower()
    significant_words = [w for w in entity_name_lower.split() if len(w) > 3]
    for mention in extracted.get("entity_mentions", []):
        if any(word in mention.lower() for word in significant_words):
            score += 0.25
            reasons.append(f"Entity name mentioned: {mention}")
            break

    all_addresses = (
        extracted.get("property_addresses", [])
        + [extracted.get("billing_address", "")]
        + [extracted.get("remittance_address", "")]
    )
    for addr in all_addresses:
        if addr:
            for pattern in entity.get("address_patterns", []):
                if pattern.lower() in addr.lower():
                    score += 0.20
                    reasons.append(f"Address match: {pattern}")
                    break

    po = extracted.get("po_number")
    po_format = entity.get("po_number_format")
    if po and po_format:
        try:
            if re.match(po_format, po, re.IGNORECASE):
                score += 0.15
                reasons.append(f"PO format match: {po}")
        except re.error:
            pass

    amount = extracted.get("total_amount", 0) or 0
    if amount and entity.get("typical_amount_min", 0) <= amount <= entity.get(
        "typical_amount_max", 999999
    ):
        score += 0.05
        reasons.append(f"Amount in range: {amount}")

    return min(score, 1.0), reasons


def score_all_entities(extracted: dict, entities: list[dict]) -> list[dict]:
    """
    Score all entities and return sorted list (highest first).
    """
    results = []
    for entity in entities:
        score, reasons = score_entity(extracted, entity)
        results.append(
            {
                "entity_id": entity["id"],
                "entity_name": entity["name"],
                "entity_vertical": entity.get("vertical"),
                "score": score,
                "reasons": reasons,
            }
        )
    results.sort(key=lambda x: x["score"], reverse=True)
    return results


# ─── Claude API calls ─────────────────────────────────────────────────────────


def _get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def extract_invoice_data(invoice_file: InvoiceFile) -> dict:
    """
    Use Claude to extract structured data from an invoice.
    Handles both text and image invoices.
    """
    client = _get_client()

    if invoice_file.is_image and invoice_file.image_data:
        # Vision extraction
        response = client.messages.create(
            model=MODEL,
            max_tokens=2000,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": invoice_file.image_media_type,
                                "data": __import__("base64")
                                .standard_b64encode(invoice_file.image_data)
                                .decode(),
                            },
                        },
                        {"type": "text", "text": EXTRACTION_PROMPT},
                    ],
                }
            ],
        )
    else:
        # Text extraction
        invoice_text = invoice_file.text or ""
        response = client.messages.create(
            model=MODEL,
            max_tokens=2000,
            messages=[
                {
                    "role": "user",
                    "content": f"{EXTRACTION_PROMPT}\n\nINVOICE TEXT:\n{invoice_text}",
                }
            ],
        )

    raw = response.content[0].text.strip()

    # Strip any accidental markdown code fences
    if raw.startswith("```"):
        raw = re.sub(r"^```[^\n]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Failed to parse extraction JSON: %s", raw[:500])
        return {
            "vendor_name_raw": "",
            "vendor_canonical": "",
            "vendor_category": "Other",
            "vendor_category_confidence": "low",
            "total_amount": 0,
            "currency": "USD",
            "entity_mentions": [],
            "property_addresses": [],
            "line_items": [],
            "field_confidence": {
                "vendor_name": "low",
                "amount": "low",
                "entity_signals": "low",
                "invoice_number": "low",
            },
            "routing_notes": "Extraction failed — raw response could not be parsed as JSON.",
        }


def classify_with_llm(extracted: dict, candidates: list[dict]) -> dict:
    """
    Use Claude to pick the best entity from the top candidates.
    """
    client = _get_client()

    prompt = CLASSIFICATION_PROMPT.format(
        extracted_json=json.dumps(extracted, indent=2),
        candidates_json=json.dumps(candidates[:5], indent=2),
    )

    response = client.messages.create(
        model=MODEL,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```[^\n]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        logger.error("Failed to parse classification JSON: %s", raw[:500])
        # Return first candidate as fallback
        if candidates:
            top = candidates[0]
            return {
                "entity_id": top["entity_id"],
                "entity_name": top["entity_name"],
                "confidence": top["score"] * 0.7,
                "reasoning": "LLM classification failed; falling back to top scoring entity.",
                "signals_used": top.get("reasons", []),
                "alternative_entity_id": candidates[1]["entity_id"] if len(candidates) > 1 else None,
                "alternative_confidence": candidates[1]["score"] * 0.7 if len(candidates) > 1 else 0.0,
            }
        return {
            "entity_id": None,
            "entity_name": None,
            "confidence": 0.0,
            "reasoning": "Classification failed entirely.",
            "signals_used": [],
            "alternative_entity_id": None,
            "alternative_confidence": 0.0,
        }


# ─── Full pipeline ────────────────────────────────────────────────────────────


class ClassificationResult:
    """Structured result from the full classification pipeline."""

    def __init__(
        self,
        entity_id: Optional[str],
        entity_name: Optional[str],
        entity_vertical: Optional[str],
        confidence: float,
        tier_used: str,
        routing_status: str,
        extracted: dict,
        signals_matched: list[str],
        llm_reasoning: Optional[str],
        top_candidates: list[dict],
        processing_time_ms: int,
    ):
        self.entity_id = entity_id
        self.entity_name = entity_name
        self.entity_vertical = entity_vertical
        self.confidence = confidence
        self.tier_used = tier_used
        self.routing_status = routing_status
        self.extracted = extracted
        self.signals_matched = signals_matched
        self.llm_reasoning = llm_reasoning
        self.top_candidates = top_candidates
        self.processing_time_ms = processing_time_ms


def run_pipeline(
    invoice_file: InvoiceFile,
    entities: list[dict],
    known_vendors: Optional[dict] = None,
) -> ClassificationResult:
    """
    Run the full three-tier classification pipeline.

    Parameters
    ----------
    invoice_file : InvoiceFile
        Parsed invoice file from extractor.py
    entities : list[dict]
        All entity profiles from the database (as dicts)
    known_vendors : dict, optional
        Map of vendor_canonical → vendor profile for Tier 1 lookup.
        Each profile should have keys: confirmed_entity_id,
        confirmed_entity_name, status.

    Returns
    -------
    ClassificationResult
    """
    start_ms = int(time.time() * 1000)
    known_vendors = known_vendors or {}

    # ── Step 1: Extract structured data via Claude ────────────────────────────
    logger.info("Extracting invoice data from %s", invoice_file.filename)
    extracted = extract_invoice_data(invoice_file)

    vendor_canonical = (extracted.get("vendor_canonical") or "").strip().lower()

    # ── Tier 1: Vendor lookup ─────────────────────────────────────────────────
    if vendor_canonical and vendor_canonical in known_vendors:
        vendor = known_vendors[vendor_canonical]
        if vendor.get("status") == "auto_route" and vendor.get("confirmed_entity_id"):
            entity_id = vendor["confirmed_entity_id"]
            entity_name = vendor.get("confirmed_entity_name", "")
            # Find vertical
            entity_vertical = next(
                (e.get("vertical") for e in entities if e["id"] == entity_id),
                None,
            )
            elapsed = int(time.time() * 1000) - start_ms
            logger.info(
                "Tier 1 auto-route: %s → %s", vendor_canonical, entity_name
            )
            return ClassificationResult(
                entity_id=entity_id,
                entity_name=entity_name,
                entity_vertical=entity_vertical,
                confidence=0.98,
                tier_used="tier1_lookup",
                routing_status="auto_routed",
                extracted=extracted,
                signals_matched=[f"Known vendor auto-route: {vendor_canonical}"],
                llm_reasoning=None,
                top_candidates=[],
                processing_time_ms=elapsed,
            )

    # ── Tier 2: Signal scoring ────────────────────────────────────────────────
    scored = score_all_entities(extracted, entities)
    top_score = scored[0]["score"] if scored else 0.0

    if top_score >= TIER2_AUTO_THRESHOLD:
        best = scored[0]
        elapsed = int(time.time() * 1000) - start_ms
        logger.info(
            "Tier 2 auto-route: score=%.2f → %s", top_score, best["entity_name"]
        )
        return ClassificationResult(
            entity_id=best["entity_id"],
            entity_name=best["entity_name"],
            entity_vertical=best.get("entity_vertical"),
            confidence=top_score,
            tier_used="tier2_scoring",
            routing_status="auto_routed",
            extracted=extracted,
            signals_matched=best["reasons"],
            llm_reasoning=None,
            top_candidates=scored[:5],
            processing_time_ms=int(time.time() * 1000) - start_ms,
        )

    # ── Tier 3: Claude AI classification ─────────────────────────────────────
    # Pass top-5 candidates to LLM
    top_candidates = scored[:5]
    logger.info(
        "Tier 3 LLM classification: top score was %.2f, sending to Claude",
        top_score,
    )
    classification = classify_with_llm(extracted, top_candidates)

    confidence = float(classification.get("confidence", 0.0))
    entity_id = classification.get("entity_id")
    entity_name = classification.get("entity_name")
    entity_vertical = next(
        (e.get("vertical") for e in entities if e["id"] == entity_id),
        None,
    )

    if confidence >= TIER3_AUTO_THRESHOLD:
        routing_status = "auto_routed"
    elif confidence >= TIER3_REVIEW_THRESHOLD:
        routing_status = "pending_review"
    else:
        routing_status = "escalated"

    # Build top_candidates list with LLM confidence blended in
    alt_id = classification.get("alternative_entity_id")
    alt_conf = classification.get("alternative_confidence", 0.0)
    enriched_candidates = []
    for c in top_candidates:
        c_copy = dict(c)
        if c["entity_id"] == entity_id:
            c_copy["llm_confidence"] = confidence
        elif c["entity_id"] == alt_id:
            c_copy["llm_confidence"] = alt_conf
        else:
            c_copy["llm_confidence"] = c["score"] * 0.5
        enriched_candidates.append(c_copy)

    elapsed = int(time.time() * 1000) - start_ms
    return ClassificationResult(
        entity_id=entity_id,
        entity_name=entity_name,
        entity_vertical=entity_vertical,
        confidence=confidence,
        tier_used="tier3_llm",
        routing_status=routing_status,
        extracted=extracted,
        signals_matched=classification.get("signals_used", []),
        llm_reasoning=classification.get("reasoning"),
        top_candidates=enriched_candidates,
        processing_time_ms=elapsed,
    )
