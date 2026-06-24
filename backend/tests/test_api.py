"""
API smoke tests — verify key endpoints return expected shapes.

Auth is open (DEMO_ACCESS_PASSWORD not set) in test env.
DB is in-memory SQLite via conftest fixtures.
No Anthropic API calls — invoice processing endpoints are not tested here.
"""
import sys
import os
from unittest.mock import MagicMock

# Stub native/heavy deps before any backend import to avoid pyo3/cryptography panics.
for mod in ("pdfplumber", "PyPDF2", "anthropic", "extractor"):
    sys.modules.setdefault(mod, MagicMock())

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from models import Base, EntityProfile


# ── App + DB wiring ───────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def test_engine():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="module")
def api(test_engine):
    from main import app, get_db
    Session = sessionmaker(bind=test_engine)

    def override_db():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = override_db

    # Seed minimal entity data
    s = Session()
    if not s.query(EntityProfile).first():
        s.add(EntityProfile(
            id="entity_01",
            name="Coastal Grand Hotel",
            canonical_name="coastal grand hotel",
            vertical="Hospitality",
            invoice_count=0,
            total_routed_amount=0.0,
        ))
        s.commit()
    s.close()

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


# ── Health ────────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_200(self, api):
        r = api.get("/api/health")
        assert r.status_code == 200

    def test_health_has_status_ok(self, api):
        r = api.get("/api/health")
        data = r.json()
        assert data.get("status") == "ok"

    def test_health_has_version(self, api):
        r = api.get("/api/health")
        data = r.json()
        assert "version" in data


# ── Entities ──────────────────────────────────────────────────────────────────

class TestEntities:
    def test_list_entities_returns_200(self, api):
        r = api.get("/api/entities")
        assert r.status_code == 200

    def test_list_entities_is_list(self, api):
        r = api.get("/api/entities")
        data = r.json()
        assert isinstance(data, list)

    def test_entity_has_required_fields(self, api):
        r = api.get("/api/entities")
        entities = r.json()
        assert len(entities) >= 1
        entity = entities[0]
        for field in ("id", "name", "vertical"):
            assert field in entity, f"missing field: {field}"


# ── Samples ───────────────────────────────────────────────────────────────────

class TestSamples:
    def test_list_samples_returns_200(self, api):
        r = api.get("/api/samples")
        assert r.status_code == 200

    def test_samples_is_list(self, api):
        r = api.get("/api/samples")
        data = r.json()
        body = data if isinstance(data, list) else data.get("samples", [])
        assert isinstance(body, list)

    def test_sample_has_content(self, api):
        r = api.get("/api/samples")
        data = r.json()
        samples = data if isinstance(data, list) else data.get("samples", [])
        assert len(samples) > 0
        sample = samples[0]
        assert "id" in sample
        assert "description" in sample


# ── Dashboard stats ───────────────────────────────────────────────────────────

class TestDashboard:
    def test_stats_returns_200(self, api):
        r = api.get("/api/dashboard")
        assert r.status_code == 200

    def test_stats_has_numeric_fields(self, api):
        r = api.get("/api/dashboard")
        data = r.json()
        totals = data.get("totals", {})
        assert isinstance(totals.get("invoices_processed"), (int, float))
        assert isinstance(totals.get("auto_routed"), (int, float))
        assert isinstance(data.get("review_queue_count"), (int, float))


# ── Review queue ──────────────────────────────────────────────────────────────

class TestReviewQueue:
    def test_list_returns_200(self, api):
        r = api.get("/api/review-queue")
        assert r.status_code == 200

    def test_list_is_list(self, api):
        r = api.get("/api/review-queue")
        data = r.json()
        assert isinstance(data, list)


# ── Audit log ─────────────────────────────────────────────────────────────────

class TestAuditLog:
    def test_list_returns_200(self, api):
        r = api.get("/api/invoices")
        assert r.status_code == 200

    def test_list_is_list_or_paged(self, api):
        r = api.get("/api/invoices")
        data = r.json()
        assert isinstance(data, (list, dict))


# ── Pipeline status ───────────────────────────────────────────────────────────

class TestPipelineStatus:
    def test_returns_200(self, api):
        r = api.get("/api/pipeline/status")
        assert r.status_code == 200

    def test_has_expected_fields(self, api):
        r = api.get("/api/pipeline/status")
        data = r.json()
        assert "today_count" in data
        assert "pending_review" in data
        assert "watcher_active" in data
        assert "last_decision" in data

    def test_today_count_is_int(self, api):
        r = api.get("/api/pipeline/status")
        data = r.json()
        assert isinstance(data["today_count"], int)

    def test_last_decision_none_or_dict(self, api):
        r = api.get("/api/pipeline/status")
        data = r.json()
        assert data["last_decision"] is None or isinstance(data["last_decision"], dict)


# ── Watcher status ────────────────────────────────────────────────────────────

class TestWatcherStatus:
    def test_watch_folder_returns_200(self, api):
        r = api.get("/api/watch-folder/status")
        assert r.status_code == 200

    def test_email_status_returns_200(self, api):
        r = api.get("/api/email/status")
        assert r.status_code == 200


# ── Vendors ───────────────────────────────────────────────────────────────────

class TestVendors:
    def test_list_returns_200(self, api):
        r = api.get("/api/vendors")
        assert r.status_code == 200

    def test_list_is_list(self, api):
        r = api.get("/api/vendors")
        data = r.json()
        assert isinstance(data, list)
