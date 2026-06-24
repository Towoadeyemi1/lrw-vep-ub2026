"""
Vendor learning and self-improvement system.

Every processed invoice creates or updates a VendorProfile.
Human confirmations drive status transitions:
  new → learning (1st confirmation)
  learning → confirmed (3rd confirmation)
  confirmed → auto_route (immediately after 3rd confirmation)

Once auto_route status is reached, the next invoice from that vendor
is handled by Tier 1 without any Claude API call.
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from models import (
    EntityProfile,
    ReviewQueue,
    RoutingDecision,
    SystemEvent,
    VendorProfile,
)

logger = logging.getLogger(__name__)


# ─── Vendor create / update ───────────────────────────────────────────────────


def update_vendor_profile(
    extracted: dict,
    classification: dict,
    db: Session,
) -> VendorProfile:
    """
    Create or update the VendorProfile for the vendor on this invoice.

    Parameters
    ----------
    extracted : dict
        Structured extraction output from classifier.extract_invoice_data().
    classification : dict
        Classification result dict with at least a 'confidence' key.
    db : Session
        Active SQLAlchemy session.

    Returns
    -------
    VendorProfile
    """
    vendor_canonical = (extracted.get("vendor_canonical") or "").strip().lower()
    if not vendor_canonical:
        vendor_canonical = "unknown_vendor"

    amount = extracted.get("total_amount") or 0
    raw_name = extracted.get("vendor_name_raw") or ""
    confidence = float(classification.get("confidence", 0.0))

    existing: Optional[VendorProfile] = (
        db.query(VendorProfile)
        .filter(VendorProfile.canonical_name == vendor_canonical)
        .first()
    )

    if not existing:
        raw_names = [raw_name] if raw_name else []
        history = [confidence]
        vendor = VendorProfile(
            id=str(uuid.uuid4()),
            canonical_name=vendor_canonical,
            raw_names=json.dumps(raw_names),
            vendor_category=extracted.get("vendor_category"),
            vendor_category_confidence=extracted.get("vendor_category_confidence", "low"),
            invoice_count=1,
            status="new",
            typical_amount_min=amount or None,
            typical_amount_max=amount or None,
            typical_amount_avg=amount or None,
            confidence_history=json.dumps(history),
            first_seen=datetime.utcnow(),
            last_seen=datetime.utcnow(),
        )
        db.add(vendor)
        db.commit()
        db.refresh(vendor)
        logger.info("Created new vendor profile: %s", vendor_canonical)
        _log_event(
            db,
            event_type="vendor_created",
            description=f"New vendor discovered: {vendor_canonical}",
            metadata={"vendor_canonical": vendor_canonical, "invoice_count": 1},
        )
        return vendor

    # ── Update existing vendor ────────────────────────────────────────────────
    raw_names: list = json.loads(existing.raw_names or "[]")
    if raw_name and raw_name not in raw_names:
        raw_names.append(raw_name)

    history: list = json.loads(existing.confidence_history or "[]")
    history.append(confidence)

    existing.raw_names = json.dumps(raw_names)
    existing.invoice_count = (existing.invoice_count or 0) + 1
    existing.confidence_history = json.dumps(history[-20:])
    existing.last_seen = datetime.utcnow()

    if amount:
        existing.typical_amount_min = (
            min(existing.typical_amount_min, amount)
            if existing.typical_amount_min is not None
            else amount
        )
        existing.typical_amount_max = (
            max(existing.typical_amount_max, amount)
            if existing.typical_amount_max is not None
            else amount
        )
        # Rolling average
        n = existing.invoice_count
        avg = existing.typical_amount_avg or 0
        existing.typical_amount_avg = (avg * (n - 1) + amount) / n

    db.commit()
    db.refresh(existing)
    return existing


def get_known_vendors_map(db: Session) -> dict:
    """
    Return a dict mapping vendor_canonical → profile dict for all vendors.
    Used by the classifier for Tier 1 lookup.
    """
    vendors = db.query(VendorProfile).all()
    result = {}
    for v in vendors:
        result[v.canonical_name] = {
            "id": v.id,
            "canonical_name": v.canonical_name,
            "status": v.status,
            "confirmed_entity_id": v.confirmed_entity_id,
            "confirmed_entity_name": v.confirmed_entity_name,
            "confirmation_count": v.confirmation_count,
        }
    return result


# ─── Human confirmation flow ──────────────────────────────────────────────────


def confirm_routing(
    review_id: str,
    entity_id: str,
    confirmed_by: str,
    db: Session,
) -> dict:
    """
    Confirm a routing decision from the review queue.

    Updates:
    - RoutingDecision.routing_status → 'confirmed'
    - ReviewQueue.status → 'confirmed'
    - VendorProfile.confirmation_count + status progression
    - EntityProfile.invoice_count + total_routed_amount

    Returns a dict with the updated vendor status.
    """
    review: Optional[ReviewQueue] = (
        db.query(ReviewQueue).filter(ReviewQueue.id == review_id).first()
    )
    if not review:
        raise ValueError(f"Review queue item not found: {review_id}")

    decision: Optional[RoutingDecision] = (
        db.query(RoutingDecision)
        .filter(RoutingDecision.id == review.routing_decision_id)
        .first()
    )
    if not decision:
        raise ValueError(
            f"Routing decision not found: {review.routing_decision_id}"
        )

    now = datetime.utcnow()

    # Update decision
    decision.routing_status = "confirmed"
    decision.human_confirmed_by = confirmed_by
    decision.human_confirmed_at = now
    if entity_id != decision.entity_id:
        decision.human_override_entity_id = entity_id
        decision.entity_id = entity_id

    # Update review queue
    review.status = "confirmed"
    review.resolved_at = now
    review.resolved_by = confirmed_by

    # Update vendor profile
    vendor: Optional[VendorProfile] = (
        db.query(VendorProfile)
        .filter(VendorProfile.canonical_name == decision.vendor_canonical)
        .first()
    )

    old_status = None
    new_status = None

    if vendor:
        entity: Optional[EntityProfile] = (
            db.query(EntityProfile)
            .filter(EntityProfile.id == entity_id)
            .first()
        )
        vendor.confirmed_entity_id = entity_id
        vendor.confirmed_entity_name = entity.name if entity else None
        vendor.confirmation_count = (vendor.confirmation_count or 0) + 1

        old_status = vendor.status

        # Status progression
        if vendor.confirmation_count >= 1 and vendor.status == "new":
            vendor.status = "learning"
        if vendor.confirmation_count >= 3 and vendor.status in ("learning", "confirmed"):
            vendor.status = "auto_route"

        new_status = vendor.status

        if entity:
            entity.invoice_count = (entity.invoice_count or 0) + 1
            entity.total_routed_amount = (
                entity.total_routed_amount or 0
            ) + (decision.amount or 0)
            entity.updated_at = now

    db.commit()

    # Log status change event if it happened
    if old_status != new_status and new_status:
        _log_event(
            db,
            event_type="vendor_status_change",
            description=(
                f"Vendor '{decision.vendor_canonical}' progressed "
                f"from '{old_status}' to '{new_status}'"
            ),
            metadata={
                "vendor_canonical": decision.vendor_canonical,
                "old_status": old_status,
                "new_status": new_status,
                "confirmation_count": vendor.confirmation_count if vendor else 0,
            },
        )
        if new_status == "auto_route":
            _log_event(
                db,
                event_type="vendor_auto_route_enabled",
                description=(
                    f"Vendor '{decision.vendor_canonical}' is now auto-routing "
                    f"to '{vendor.confirmed_entity_name}'"
                ),
                metadata={
                    "vendor_canonical": decision.vendor_canonical,
                    "entity_id": entity_id,
                    "entity_name": vendor.confirmed_entity_name,
                },
            )

    return {
        "review_id": review_id,
        "routing_decision_id": decision.id,
        "entity_id": entity_id,
        "vendor_status": new_status,
        "confirmation_count": vendor.confirmation_count if vendor else 0,
    }


def reject_routing(
    review_id: str,
    reason: Optional[str],
    rejected_by: str,
    db: Session,
) -> dict:
    """
    Reject a routing decision — marks it for escalation.
    """
    review: Optional[ReviewQueue] = (
        db.query(ReviewQueue).filter(ReviewQueue.id == review_id).first()
    )
    if not review:
        raise ValueError(f"Review queue item not found: {review_id}")

    decision: Optional[RoutingDecision] = (
        db.query(RoutingDecision)
        .filter(RoutingDecision.id == review.routing_decision_id)
        .first()
    )

    now = datetime.utcnow()
    review.status = "rejected"
    review.resolved_at = now
    review.resolved_by = rejected_by

    if decision:
        decision.routing_status = "escalated"
        decision.human_confirmed_by = rejected_by
        decision.human_confirmed_at = now

    db.commit()

    _log_event(
        db,
        event_type="routing_rejected",
        description=f"Routing rejected by {rejected_by}: {reason or 'no reason given'}",
        metadata={
            "review_id": review_id,
            "reason": reason,
            "rejected_by": rejected_by,
        },
    )

    return {"review_id": review_id, "status": "rejected"}


# ─── Helper ───────────────────────────────────────────────────────────────────


def _log_event(
    db: Session,
    event_type: str,
    description: str,
    metadata: Optional[dict] = None,
) -> None:
    """Insert a SystemEvent row."""
    event = SystemEvent(
        id=str(uuid.uuid4()),
        event_type=event_type,
        description=description,
        event_metadata=json.dumps(metadata or {}),
        created_at=datetime.utcnow(),
    )
    db.add(event)
    db.commit()
