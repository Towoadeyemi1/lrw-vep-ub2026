"""
Unit tests for vendor learning lifecycle in vendor_learning.py.

Uses an in-memory SQLite DB (via conftest.py fixtures).
No Anthropic API calls.
"""
import sys
import os
from unittest.mock import MagicMock

for mod in ("pdfplumber", "PyPDF2", "anthropic", "extractor"):
    sys.modules.setdefault(mod, MagicMock())

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import json
import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, VendorProfile, EntityProfile, RoutingDecision, ReviewQueue
from vendor_learning import update_vendor_profile, confirm_routing, get_known_vendors_map


# ── In-process DB fixture — isolated file-based SQLite per test ───────────────

@pytest.fixture()
def db(tmp_path):
    # tmp_path is a pytest built-in: a unique directory per test invocation.
    # Using a file ensures each test has a completely isolated database,
    # avoiding any StaticPool / in-memory connection-sharing issues.
    db_file = str(tmp_path / "test.db")
    engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.rollback()
    session.close()
    engine.dispose()


@pytest.fixture()
def seeded_entity(db):
    entity = db.get(EntityProfile, "entity_01")
    if entity is None:
        entity = EntityProfile(
            id="entity_01",
            name="Coastal Grand Hotel",
            canonical_name="coastal grand hotel",
            vertical="Hospitality",
            invoice_count=0,
            total_routed_amount=0.0,
        )
        db.add(entity)
        db.commit()
    return entity


def _make_extracted(canonical="sysco food services", category="Food Service", amount=3000.0):
    return {
        "vendor_canonical": canonical,
        "vendor_name_raw": "SYSCO FOOD SERVICES",
        "vendor_category": category,
        "vendor_category_confidence": "high",
        "total_amount": amount,
    }


def _make_classification(confidence=0.88, entity_id="entity_01"):
    return {"confidence": confidence, "entity_id": entity_id}


# ── update_vendor_profile ─────────────────────────────────────────────────────

class TestUpdateVendorProfile:
    def test_creates_new_vendor(self, db):
        extracted = _make_extracted()
        classification = _make_classification()
        vendor = update_vendor_profile(extracted, classification, db)
        assert vendor.canonical_name == "sysco food services"
        assert vendor.status == "new"
        assert vendor.invoice_count == 1

    def test_new_vendor_amount_set(self, db):
        extracted = _make_extracted(amount=5000.0)
        vendor = update_vendor_profile(extracted, _make_classification(), db)
        assert vendor.typical_amount_min == 5000.0
        assert vendor.typical_amount_max == 5000.0

    def test_updates_existing_vendor_invoice_count(self, db):
        extracted = _make_extracted()
        update_vendor_profile(extracted, _make_classification(), db)
        update_vendor_profile(extracted, _make_classification(), db)
        vendor = db.query(VendorProfile).filter_by(canonical_name="sysco food services").first()
        assert vendor.invoice_count == 2

    def test_amount_range_tracks_min_max(self, db):
        update_vendor_profile(_make_extracted(amount=1000.0), _make_classification(), db)
        update_vendor_profile(_make_extracted(amount=9000.0), _make_classification(), db)
        vendor = db.query(VendorProfile).filter_by(canonical_name="sysco food services").first()
        assert vendor.typical_amount_min == 1000.0
        assert vendor.typical_amount_max == 9000.0

    def test_unknown_vendor_canonical_fallback(self, db):
        extracted = _make_extracted(canonical="")
        vendor = update_vendor_profile(extracted, _make_classification(), db)
        assert vendor.canonical_name == "unknown_vendor"

    def test_confidence_history_appended(self, db):
        update_vendor_profile(_make_extracted(), _make_classification(confidence=0.9), db)
        update_vendor_profile(_make_extracted(), _make_classification(confidence=0.8), db)
        vendor = db.query(VendorProfile).filter_by(canonical_name="sysco food services").first()
        history = json.loads(vendor.confidence_history)
        assert 0.9 in history
        assert 0.8 in history


# ── Vendor status lifecycle via confirm_routing ───────────────────────────────

def _seed_review(db, canonical="sysco food services", entity_id="entity_01", amount=1000.0):
    """Create the minimum DB rows needed to call confirm_routing."""
    decision_id = str(uuid.uuid4())
    decision = RoutingDecision(
        id=decision_id,
        vendor_canonical=canonical,
        vendor_name_raw="SYSCO",
        entity_id=entity_id,
        routing_status="pending_review",
        amount=amount,
        source="test",
    )
    db.add(decision)

    review_id = str(uuid.uuid4())
    review = ReviewQueue(
        id=review_id,
        routing_decision_id=decision_id,
        status="pending",
    )
    db.add(review)
    db.commit()
    return review_id


class TestVendorStatusLifecycle:
    def test_first_confirmation_new_to_learning(self, db, seeded_entity):
        # Create vendor at 'new' status
        update_vendor_profile(_make_extracted(), _make_classification(), db)

        review_id = _seed_review(db)
        result = confirm_routing(review_id, "entity_01", "test_user", db)

        vendor = db.query(VendorProfile).filter_by(canonical_name="sysco food services").first()
        assert vendor.status == "learning"
        assert vendor.confirmation_count == 1

    def test_third_confirmation_reaches_auto_route(self, db, seeded_entity):
        update_vendor_profile(_make_extracted(), _make_classification(), db)

        for _ in range(3):
            review_id = _seed_review(db)
            confirm_routing(review_id, "entity_01", "test_user", db)

        vendor = db.query(VendorProfile).filter_by(canonical_name="sysco food services").first()
        assert vendor.status == "auto_route"
        assert vendor.confirmation_count == 3

    def test_entity_invoice_count_incremented(self, db, seeded_entity):
        update_vendor_profile(_make_extracted(), _make_classification(), db)
        review_id = _seed_review(db, amount=2500.0)
        confirm_routing(review_id, "entity_01", "test_user", db)

        entity = db.query(EntityProfile).filter_by(id="entity_01").first()
        assert entity.invoice_count == 1
        assert entity.total_routed_amount == 2500.0

    def test_confirm_nonexistent_review_raises(self, db):
        with pytest.raises(ValueError, match="Review queue item not found"):
            confirm_routing("nonexistent-id", "entity_01", "user", db)

    def test_override_entity_recorded(self, db, seeded_entity):
        """Confirming to a different entity than originally routed sets override field."""
        entity2 = EntityProfile(
            id="entity_02",
            name="Ocean View Suites",
            canonical_name="ocean view suites",
            vertical="Hospitality",
            invoice_count=0,
            total_routed_amount=0.0,
        )
        db.add(entity2)
        db.commit()

        update_vendor_profile(_make_extracted(), _make_classification(), db)
        review_id = _seed_review(db)
        confirm_routing(review_id, "entity_02", "test_user", db)

        decision = db.query(RoutingDecision).filter_by(routing_status="confirmed").first()
        assert decision.human_override_entity_id == "entity_02"


# ── get_known_vendors_map ─────────────────────────────────────────────────────

class TestGetKnownVendorsMap:
    def test_empty_db_returns_empty_dict(self, db):
        result = get_known_vendors_map(db)
        assert result == {}

    def test_vendor_appears_in_map(self, db):
        update_vendor_profile(_make_extracted(), _make_classification(), db)
        result = get_known_vendors_map(db)
        assert "sysco food services" in result

    def test_map_contains_status(self, db):
        update_vendor_profile(_make_extracted(), _make_classification(), db)
        result = get_known_vendors_map(db)
        vendor = result["sysco food services"]
        assert vendor["status"] == "new"
        assert "confirmation_count" in vendor
