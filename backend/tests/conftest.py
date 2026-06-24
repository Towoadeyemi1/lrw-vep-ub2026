"""Shared pytest fixtures — entity dict stubs used by test_classifier.py."""
import pytest


@pytest.fixture()
def sample_entity():
    return {
        "id": "entity_01",
        "name": "Coastal Grand Hotel",
        "vertical": "Hospitality",
        "address_patterns": ["247 harbour rd", "coastal grand"],
        "known_vendor_categories": ["Food Service", "Commercial Linen", "HVAC"],
        "po_number_format": r"^CGH-\d{4}$",
        "typical_amount_min": 500,
        "typical_amount_max": 15000,
        "routing_email": "ap@coastalgrand.com",
    }


@pytest.fixture()
def sample_entity_b():
    return {
        "id": "entity_02",
        "name": "Ocean View Suites",
        "vertical": "Hospitality",
        "address_patterns": ["12 marina blvd"],
        "known_vendor_categories": ["Cleaning", "Landscaping"],
        "po_number_format": r"^OVS-\d{4}$",
        "typical_amount_min": 200,
        "typical_amount_max": 5000,
        "routing_email": "ap@oceanviewsuites.com",
    }
