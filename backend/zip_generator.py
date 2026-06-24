"""
ZIP export generator for invoice routing data.

Produces a ZIP archive containing:
  - routing_decisions.json     — all routing decisions
  - vendor_profiles.json       — all vendor profiles
  - entity_summary.json        — entity profiles with counts
  - review_queue.json          — review queue items
  - system_events.json         — recent system events
  - report.xlsx                — Excel workbook (calls excel_generator)
  - README.txt                 — schema description
"""

from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime
from typing import Any

from models import EntityProfile, ReviewQueue, RoutingDecision, SystemEvent, VendorProfile
from excel_generator import generate_excel_report


README_CONTENT = """Invoice Routing Intelligence — Data Export
==========================================

Generated: {timestamp}

Files in this archive:
----------------------
routing_decisions.json  — All processed invoices with routing results
vendor_profiles.json    — Vendor learning profiles (status, confirmation history)
entity_summary.json     — Business entity profiles with cumulative stats
review_queue.json       — Human review queue (pending and resolved)
system_events.json      — System event log
report.xlsx             — Multi-sheet Excel workbook (same data, formatted)

Routing Status Values:
  auto_routed     — Automatically routed with high confidence
  pending_review  — Sent to human review queue (medium confidence)
  escalated       — Low confidence, requires manual investigation
  confirmed       — Human-confirmed routing
  rejected        — Human-rejected, re-escalated

Vendor Status Values:
  new             — First invoice from this vendor
  learning        — 1+ confirmation(s), building confidence
  confirmed       — Multiple confirmations, consistent routing
  auto_route      — 3+ confirmations, now routes automatically (Tier 1)

Confidence Tiers:
  tier1_lookup    — Vendor known and auto-routing (confidence ~0.98)
  tier2_scoring   — Signal scoring (address, PO, category) ≥ 0.80
  tier3_llm       — Claude AI classification (used when scoring < 0.80)
  human_review    — Sent to human (confidence < 0.55)
"""


def _model_to_dict(obj: Any) -> dict:
    """Convert a SQLAlchemy model instance to a JSON-serialisable dict."""
    result = {}
    for col in obj.__class__.__table__.columns:
        val = getattr(obj, col.name)
        if isinstance(val, datetime):
            val = val.isoformat()
        result[col.name] = val
    return result


def generate_zip_export(
    decisions: list[RoutingDecision],
    vendors: list[VendorProfile],
    entities: list[EntityProfile],
    reviews: list[ReviewQueue],
    events: list[SystemEvent],
) -> bytes:
    """
    Generate a complete ZIP archive and return it as bytes.
    """
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    ts_filename = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    # Convert models to dicts
    decisions_data = [_model_to_dict(d) for d in decisions]
    vendors_data = [_model_to_dict(v) for v in vendors]
    entities_data = [_model_to_dict(e) for e in entities]
    reviews_data = [_model_to_dict(r) for r in reviews]
    events_data = [_model_to_dict(ev) for ev in events]

    # Build entity summary with computed stats
    decision_by_entity: dict[str, dict] = {}
    for d in decisions:
        eid = d.entity_id or "unassigned"
        if eid not in decision_by_entity:
            decision_by_entity[eid] = {
                "invoice_count": 0,
                "total_amount": 0.0,
                "auto_routed": 0,
                "human_confirmed": 0,
                "pending": 0,
                "escalated": 0,
            }
        decision_by_entity[eid]["invoice_count"] += 1
        decision_by_entity[eid]["total_amount"] += d.amount or 0
        status = d.routing_status or ""
        if status == "auto_routed":
            decision_by_entity[eid]["auto_routed"] += 1
        elif status == "confirmed":
            decision_by_entity[eid]["human_confirmed"] += 1
        elif status == "pending_review":
            decision_by_entity[eid]["pending"] += 1
        elif status == "escalated":
            decision_by_entity[eid]["escalated"] += 1

    entity_summary = []
    for e in entities:
        e_dict = _model_to_dict(e)
        stats = decision_by_entity.get(e.id, {
            "invoice_count": 0, "total_amount": 0.0,
            "auto_routed": 0, "human_confirmed": 0,
            "pending": 0, "escalated": 0,
        })
        e_dict["computed_stats"] = stats
        entity_summary.append(e_dict)

    # Generate Excel
    try:
        excel_bytes = generate_excel_report(decisions, vendors, entities, reviews)
    except Exception as exc:
        excel_bytes = None

    # Build ZIP
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            f"invoice_routing_export_{ts_filename}/routing_decisions.json",
            json.dumps(decisions_data, indent=2, default=str),
        )
        zf.writestr(
            f"invoice_routing_export_{ts_filename}/vendor_profiles.json",
            json.dumps(vendors_data, indent=2, default=str),
        )
        zf.writestr(
            f"invoice_routing_export_{ts_filename}/entity_summary.json",
            json.dumps(entity_summary, indent=2, default=str),
        )
        zf.writestr(
            f"invoice_routing_export_{ts_filename}/review_queue.json",
            json.dumps(reviews_data, indent=2, default=str),
        )
        zf.writestr(
            f"invoice_routing_export_{ts_filename}/system_events.json",
            json.dumps(events_data, indent=2, default=str),
        )
        zf.writestr(
            f"invoice_routing_export_{ts_filename}/README.txt",
            README_CONTENT.format(timestamp=timestamp),
        )
        if excel_bytes:
            zf.writestr(
                f"invoice_routing_export_{ts_filename}/report.xlsx",
                excel_bytes,
            )

    buf.seek(0)
    return buf.getvalue()
