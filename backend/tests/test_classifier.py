"""
Unit tests for Tier 2 signal scoring in classifier.py.

These tests are fully offline — no Claude API calls involved.
"""
import sys
import os
from unittest.mock import MagicMock

# Stub out heavy / broken native deps before importing backend modules
for mod in ("pdfplumber", "PyPDF2", "anthropic", "extractor"):
    sys.modules.setdefault(mod, MagicMock())
if "extractor" not in sys.modules or not hasattr(sys.modules["extractor"], "InvoiceFile"):
    sys.modules["extractor"] = MagicMock()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from classifier import score_entity, score_all_entities


# ── Fixtures ──────────────────────────────────────────────────────────────────

ENTITY = {
    "id": "entity_01",
    "name": "Coastal Grand Hotel",
    "vertical": "Hospitality",
    "address_patterns": ["247 harbour rd", "coastal grand"],
    "known_vendor_categories": ["Food Service", "Commercial Linen", "HVAC"],
    "po_number_format": r"^CGH-\d{4}$",
    "typical_amount_min": 500,
    "typical_amount_max": 15000,
}

ENTITY_B = {
    "id": "entity_02",
    "name": "Ocean View Suites",
    "vertical": "Hospitality",
    "address_patterns": ["12 marina blvd"],
    "known_vendor_categories": ["Cleaning", "Landscaping"],
    "po_number_format": r"^OVS-\d{4}$",
    "typical_amount_min": 200,
    "typical_amount_max": 5000,
}


# ── score_entity individual signals ──────────────────────────────────────────

class TestScoreEntitySignals:
    def test_no_signals_returns_zero(self):
        extracted = {"vendor_category": "", "entity_mentions": [], "total_amount": 0}
        score, reasons = score_entity(extracted, ENTITY)
        assert score == 0.0
        assert reasons == []

    def test_category_match_adds_0_35(self):
        extracted = {
            "vendor_category": "Food Service",
            "entity_mentions": [],
            "property_addresses": [],
            "billing_address": "",
            "remittance_address": "",
        }
        score, reasons = score_entity(extracted, ENTITY)
        assert abs(score - 0.35) < 1e-9
        assert any("Category match" in r for r in reasons)

    def test_category_partial_match(self):
        """'food service catering' should still match 'Food Service'."""
        extracted = {
            "vendor_category": "food service catering",
            "entity_mentions": [],
            "property_addresses": [],
            "billing_address": "",
            "remittance_address": "",
        }
        score, _ = score_entity(extracted, ENTITY)
        assert score >= 0.35

    def test_entity_mention_adds_0_25(self):
        extracted = {
            "vendor_category": "",
            "entity_mentions": ["Coastal Grand Hotel"],
            "property_addresses": [],
            "billing_address": "",
            "remittance_address": "",
        }
        score, reasons = score_entity(extracted, ENTITY)
        assert abs(score - 0.25) < 1e-9
        assert any("Entity name mentioned" in r for r in reasons)

    def test_entity_mention_matches_significant_word(self):
        """Partial match on a significant word (>3 chars) should trigger."""
        extracted = {
            "vendor_category": "",
            "entity_mentions": ["Coastal Grand"],
            "property_addresses": [],
            "billing_address": "",
            "remittance_address": "",
        }
        score, _ = score_entity(extracted, ENTITY)
        assert score >= 0.25

    def test_address_match_in_property_addresses_adds_0_20(self):
        extracted = {
            "vendor_category": "",
            "entity_mentions": [],
            "property_addresses": ["247 Harbour Rd, Port City"],
            "billing_address": "",
            "remittance_address": "",
        }
        score, reasons = score_entity(extracted, ENTITY)
        assert abs(score - 0.20) < 1e-9
        assert any("Address match" in r for r in reasons)

    def test_address_match_in_billing_address(self):
        extracted = {
            "vendor_category": "",
            "entity_mentions": [],
            "property_addresses": [],
            "billing_address": "Coastal Grand Hotel, 247 Harbour Rd",
            "remittance_address": "",
        }
        score, _ = score_entity(extracted, ENTITY)
        assert score >= 0.20

    def test_po_format_match_adds_0_15(self):
        extracted = {
            "vendor_category": "",
            "entity_mentions": [],
            "property_addresses": [],
            "billing_address": "",
            "remittance_address": "",
            "po_number": "CGH-1234",
        }
        score, reasons = score_entity(extracted, ENTITY)
        assert abs(score - 0.15) < 1e-9
        assert any("PO format match" in r for r in reasons)

    def test_po_format_mismatch_adds_nothing(self):
        extracted = {
            "vendor_category": "",
            "entity_mentions": [],
            "property_addresses": [],
            "billing_address": "",
            "remittance_address": "",
            "po_number": "OVS-9999",
        }
        score, _ = score_entity(extracted, ENTITY)
        assert score == 0.0

    def test_amount_in_range_adds_0_05(self):
        extracted = {
            "vendor_category": "",
            "entity_mentions": [],
            "property_addresses": [],
            "billing_address": "",
            "remittance_address": "",
            "total_amount": 5000,
        }
        score, reasons = score_entity(extracted, ENTITY)
        assert abs(score - 0.05) < 1e-9
        assert any("Amount in range" in r for r in reasons)

    def test_amount_out_of_range_adds_nothing(self):
        extracted = {
            "vendor_category": "",
            "entity_mentions": [],
            "property_addresses": [],
            "billing_address": "",
            "remittance_address": "",
            "total_amount": 99999,
        }
        score, _ = score_entity(extracted, ENTITY)
        assert score == 0.0

    def test_all_signals_caps_at_1_0(self):
        extracted = {
            "vendor_category": "Food Service",
            "entity_mentions": ["Coastal Grand Hotel"],
            "property_addresses": ["247 Harbour Rd"],
            "billing_address": "",
            "remittance_address": "",
            "po_number": "CGH-0001",
            "total_amount": 3000,
        }
        score, reasons = score_entity(extracted, ENTITY)
        assert score == 1.0
        assert len(reasons) == 5

    def test_score_never_exceeds_1_0(self):
        """Even with duplicate address matches the cap holds."""
        extracted = {
            "vendor_category": "Food Service",
            "entity_mentions": ["Coastal Grand Hotel", "Coastal Grand"],
            "property_addresses": ["247 Harbour Rd", "Coastal Grand lobby"],
            "billing_address": "247 harbour rd",
            "remittance_address": "",
            "po_number": "CGH-9999",
            "total_amount": 5000,
        }
        score, _ = score_entity(extracted, ENTITY)
        assert score <= 1.0


# ── score_all_entities ────────────────────────────────────────────────────────

class TestScoreAllEntities:
    def test_returns_sorted_highest_first(self):
        extracted = {
            "vendor_category": "Food Service",
            "entity_mentions": ["Coastal Grand Hotel"],
            "property_addresses": [],
            "billing_address": "",
            "remittance_address": "",
        }
        results = score_all_entities(extracted, [ENTITY, ENTITY_B])
        assert results[0]["entity_id"] == "entity_01"
        assert results[0]["score"] > results[1]["score"]

    def test_returns_all_entities(self):
        extracted = {"vendor_category": "", "entity_mentions": []}
        results = score_all_entities(extracted, [ENTITY, ENTITY_B])
        assert len(results) == 2

    def test_empty_entity_list(self):
        extracted = {"vendor_category": "Food Service"}
        results = score_all_entities(extracted, [])
        assert results == []

    def test_result_structure(self):
        extracted = {"vendor_category": "Cleaning", "entity_mentions": []}
        results = score_all_entities(extracted, [ENTITY_B])
        assert "entity_id" in results[0]
        assert "entity_name" in results[0]
        assert "score" in results[0]
        assert "reasons" in results[0]
        assert "entity_vertical" in results[0]

    def test_correct_winner_on_category(self):
        """ENTITY_B has 'Cleaning' in its categories — should win on a cleaning invoice."""
        extracted = {
            "vendor_category": "Cleaning",
            "entity_mentions": [],
            "property_addresses": [],
            "billing_address": "",
            "remittance_address": "",
        }
        results = score_all_entities(extracted, [ENTITY, ENTITY_B])
        assert results[0]["entity_id"] == "entity_02"
