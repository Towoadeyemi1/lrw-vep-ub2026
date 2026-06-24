"""
Invoice Routing Intelligence — FastAPI backend.

All routes are prefixed with /api/.
Authentication: X-Demo-Password header or ?password= query param on all
routes except /api/health.

Startup sequence:
  1. Create DB tables
  2. Seed entity profiles (idempotent)
  3. Start folder watcher (background thread)
  4. Start email watcher (background thread)
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import (
    Depends,
    FastAPI,
    File,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session

import auth
import email_watcher
import excel_generator
import folder_watcher
import zip_generator
from classifier import run_pipeline, ClassificationResult
from database import SessionLocal, get_db, init_db
from extractor import InvoiceFile, parse_upload
from models import (
    EntityProfile,
    ReviewQueue,
    RoutingDecision,
    SystemEvent,
    VendorProfile,
)
from sample_invoices import SAMPLE_INVOICES
from schemas import (
    ConfirmRoutingRequest,
    DashboardResponse,
    ProcessTextRequest,
    RejectRoutingRequest,
)
from seed_data import SEED_ENTITIES
from vendor_learning import (
    confirm_routing,
    get_known_vendors_map,
    reject_routing,
    update_vendor_profile,
    _log_event,
)

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Invoice Routing Intelligence",
    description="AI-powered multi-entity invoice routing system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Startup / Shutdown ───────────────────────────────────────────────────────


@app.on_event("startup")
async def startup_event():
    logger.info("Starting Invoice Routing Intelligence backend")

    # Create database tables
    init_db()
    logger.info("Database initialised")

    # Seed entity profiles
    _seed_entities()

    # Start background watchers
    _start_background_watchers()

    logger.info("Backend startup complete")


@app.on_event("shutdown")
async def shutdown_event():
    folder_watcher.stop_watcher()
    email_watcher.stop_watcher()
    logger.info("Backend shut down cleanly")


def _seed_entities():
    """Insert seed entities if they don't already exist."""
    db = SessionLocal()
    try:
        for entity_data in SEED_ENTITIES:
            existing = db.query(EntityProfile).filter(
                EntityProfile.id == entity_data["id"]
            ).first()
            if not existing:
                entity = EntityProfile(
                    id=entity_data["id"],
                    name=entity_data["name"],
                    canonical_name=entity_data["canonical_name"],
                    vertical=entity_data["vertical"],
                    address_patterns=json.dumps(entity_data.get("address_patterns", [])),
                    known_vendor_categories=json.dumps(
                        entity_data.get("known_vendor_categories", [])
                    ),
                    po_number_format=entity_data.get("po_number_format"),
                    typical_amount_min=entity_data.get("typical_amount_min", 0),
                    typical_amount_max=entity_data.get("typical_amount_max", 999999),
                    routing_email=entity_data.get("routing_email"),
                    review_contact=entity_data.get("review_contact"),
                    invoice_count=0,
                    total_routed_amount=0,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                db.add(entity)
        db.commit()
        logger.info("Entity profiles seeded (%d entities)", len(SEED_ENTITIES))
    finally:
        db.close()


def _start_background_watchers():
    """Start folder and email watchers."""

    def sync_process_callback(
        data: bytes,
        filename: str,
        source: str = "folder_watch",
        source_metadata: Optional[dict] = None,
    ):
        """Synchronous wrapper called from background threads."""
        db = SessionLocal()
        try:
            invoice_file = parse_upload(data, filename)
            entities = _get_entities_as_dicts(db)
            known_vendors = get_known_vendors_map(db)
            result = run_pipeline(invoice_file, entities, known_vendors)
            _persist_classification(
                db=db,
                invoice_file=invoice_file,
                result=result,
                source=source,
                source_metadata=source_metadata or {},
            )
        except Exception as exc:
            logger.error("Background processing error for %s: %s", filename, exc)
        finally:
            db.close()

    folder_started = folder_watcher.start_watcher(sync_process_callback)
    if folder_started:
        logger.info("Folder watcher started: %s", folder_watcher.WATCH_DIR)
    else:
        logger.warning("Folder watcher not started (directory unavailable)")

    email_started = email_watcher.start_watcher(sync_process_callback)
    if email_started:
        logger.info("Email watcher started for %s", email_watcher.GMAIL_EMAIL)
    else:
        logger.warning("Email watcher not started (credentials not configured or unreachable)")


# ─── Helpers ──────────────────────────────────────────────────────────────────


def _get_entities_as_dicts(db: Session) -> list[dict]:
    """Load all entities and convert to plain dicts for the classifier."""
    entities = db.query(EntityProfile).all()
    result = []
    for e in entities:
        result.append({
            "id": e.id,
            "name": e.name,
            "canonical_name": e.canonical_name,
            "vertical": e.vertical,
            "address_patterns": json.loads(e.address_patterns or "[]"),
            "known_vendor_categories": json.loads(e.known_vendor_categories or "[]"),
            "po_number_format": e.po_number_format,
            "typical_amount_min": e.typical_amount_min or 0,
            "typical_amount_max": e.typical_amount_max or 999999,
        })
    return result


def _persist_classification(
    db: Session,
    invoice_file: InvoiceFile,
    result: ClassificationResult,
    source: str = "web_upload",
    source_metadata: Optional[dict] = None,
) -> RoutingDecision:
    """
    Persist a ClassificationResult to the database.
    Creates RoutingDecision, updates VendorProfile, creates ReviewQueue
    item if needed, logs SystemEvent.
    Returns the created RoutingDecision.
    """
    extracted = result.extracted
    decision_id = str(uuid.uuid4())

    decision = RoutingDecision(
        id=decision_id,
        invoice_filename=invoice_file.filename,
        invoice_number=extracted.get("invoice_number"),
        vendor_name_raw=extracted.get("vendor_name_raw"),
        vendor_canonical=extracted.get("vendor_canonical", "").strip().lower() or None,
        vendor_status_at_time=None,  # set below
        entity_id=result.entity_id,
        entity_name=result.entity_name,
        entity_vertical=result.entity_vertical,
        confidence_score=result.confidence,
        tier_used=result.tier_used,
        routing_status=result.routing_status,
        extracted_data=json.dumps(extracted),
        signals_matched=json.dumps(result.signals_matched),
        llm_reasoning=result.llm_reasoning,
        top_candidates=json.dumps(result.top_candidates),
        amount=extracted.get("total_amount"),
        currency=extracted.get("currency", "USD"),
        invoice_date=extracted.get("invoice_date"),
        po_number=extracted.get("po_number"),
        line_items=json.dumps(extracted.get("line_items", [])),
        processing_time_ms=result.processing_time_ms,
        source=source,
        source_metadata=json.dumps(source_metadata or {}),
        created_at=datetime.utcnow(),
    )

    db.add(decision)

    # Update vendor profile
    vendor = update_vendor_profile(
        extracted=extracted,
        classification={"confidence": result.confidence, "entity_id": result.entity_id},
        db=db,
    )
    decision.vendor_id = vendor.id
    decision.vendor_status_at_time = vendor.status

    db.commit()

    # Create review queue entry if needed
    if result.routing_status in ("pending_review", "escalated"):
        review = ReviewQueue(
            id=str(uuid.uuid4()),
            routing_decision_id=decision_id,
            top_candidates=json.dumps(result.top_candidates),
            invoice_filename=invoice_file.filename,
            vendor_name=extracted.get("vendor_name_raw"),
            amount=extracted.get("total_amount"),
            extracted_data=json.dumps(extracted),
            priority="high" if result.routing_status == "escalated" else "normal",
            status="pending",
            created_at=datetime.utcnow(),
        )
        db.add(review)
        db.commit()

    # Log system event
    _log_event(
        db,
        event_type="invoice_processed",
        description=(
            f"Invoice '{invoice_file.filename}' processed via {result.tier_used} "
            f"→ {result.routing_status} (confidence {result.confidence:.2f})"
        ),
        metadata={
            "decision_id": decision_id,
            "filename": invoice_file.filename,
            "tier": result.tier_used,
            "status": result.routing_status,
            "entity": result.entity_name,
            "confidence": result.confidence,
        },
    )

    return decision


def _decision_to_dict(d: RoutingDecision) -> dict:
    """Convert RoutingDecision ORM object to a JSON-serialisable dict."""
    return {
        "id": d.id,
        "invoice_filename": d.invoice_filename,
        "invoice_number": d.invoice_number,
        "vendor_name_raw": d.vendor_name_raw,
        "vendor_canonical": d.vendor_canonical,
        "vendor_status_at_time": d.vendor_status_at_time,
        "entity_id": d.entity_id,
        "entity_name": d.entity_name,
        "entity_vertical": d.entity_vertical,
        "confidence_score": d.confidence_score,
        "tier_used": d.tier_used,
        "routing_status": d.routing_status,
        "extracted_data": _safe_json(d.extracted_data),
        "signals_matched": _safe_json(d.signals_matched),
        "llm_reasoning": d.llm_reasoning,
        "top_candidates": _safe_json(d.top_candidates),
        "amount": d.amount,
        "currency": d.currency,
        "invoice_date": d.invoice_date,
        "po_number": d.po_number,
        "line_items": _safe_json(d.line_items),
        "human_confirmed_by": d.human_confirmed_by,
        "human_confirmed_at": d.human_confirmed_at.isoformat() if d.human_confirmed_at else None,
        "human_override_entity_id": d.human_override_entity_id,
        "processing_time_ms": d.processing_time_ms,
        "source": d.source,
        "source_metadata": _safe_json(d.source_metadata),
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def _review_to_dict(r: ReviewQueue) -> dict:
    return {
        "id": r.id,
        "routing_decision_id": r.routing_decision_id,
        "top_candidates": _safe_json(r.top_candidates),
        "invoice_filename": r.invoice_filename,
        "vendor_name": r.vendor_name,
        "amount": r.amount,
        "extracted_data": _safe_json(r.extracted_data),
        "priority": r.priority,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
        "resolved_by": r.resolved_by,
    }


def _safe_json(raw: Optional[str]) -> Any:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return raw


# ─── Routes ───────────────────────────────────────────────────────────────────


@app.get("/api/health")
async def health():
    """Health check — no auth required."""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "Invoice Routing Intelligence",
        "version": "1.0.0",
    }


# ── Dashboard ──────────────────────────────────────────────────────────────────


@app.get("/api/dashboard")
async def get_dashboard(
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Full dashboard statistics."""
    decisions = db.query(RoutingDecision).all()
    vendors = db.query(VendorProfile).all()
    entities = db.query(EntityProfile).all()
    review_count = db.query(ReviewQueue).filter(ReviewQueue.status == "pending").count()
    events = (
        db.query(SystemEvent)
        .order_by(SystemEvent.created_at.desc())
        .limit(20)
        .all()
    )

    # Totals
    total = len(decisions)
    auto_routed = sum(1 for d in decisions if d.routing_status == "auto_routed")
    human_review = sum(1 for d in decisions if d.routing_status == "pending_review")
    escalated = sum(1 for d in decisions if d.routing_status == "escalated")
    confirmed = sum(1 for d in decisions if d.routing_status == "confirmed")
    total_amount = sum(d.amount or 0 for d in decisions)

    # Tiers
    t1 = sum(1 for d in decisions if d.tier_used == "tier1_lookup")
    t2 = sum(1 for d in decisions if d.tier_used == "tier2_scoring")
    t3 = sum(1 for d in decisions if d.tier_used == "tier3_llm")
    t_human = sum(1 for d in decisions if d.tier_used == "human_review")

    # Confidence distribution
    conf_high = sum(1 for d in decisions if (d.confidence_score or 0) >= 0.90)
    conf_med = sum(1 for d in decisions if 0.70 <= (d.confidence_score or 0) < 0.90)
    conf_low = sum(1 for d in decisions if 0.50 <= (d.confidence_score or 0) < 0.70)
    conf_vlow = sum(1 for d in decisions if (d.confidence_score or 0) < 0.50)

    # Entity stats
    entity_stats = []
    for e in entities:
        e_decisions = [d for d in decisions if d.entity_id == e.id]
        entity_stats.append({
            "id": e.id,
            "name": e.name,
            "vertical": e.vertical,
            "invoice_count": len(e_decisions),
            "total_amount": sum(d.amount or 0 for d in e_decisions),
            "auto_routed": sum(1 for d in e_decisions if d.routing_status == "auto_routed"),
            "confirmed": sum(1 for d in e_decisions if d.routing_status == "confirmed"),
        })

    # Recent decisions (last 10)
    recent = (
        db.query(RoutingDecision)
        .order_by(RoutingDecision.created_at.desc())
        .limit(10)
        .all()
    )

    return {
        "totals": {
            "invoices_processed": total,
            "auto_routed": auto_routed,
            "auto_routed_pct": round(auto_routed / total * 100, 1) if total else 0.0,
            "human_review": human_review,
            "escalated": escalated,
            "confirmed": confirmed,
            "total_amount_processed": round(total_amount, 2),
        },
        "vendors": {
            "total": len(vendors),
            "new": sum(1 for v in vendors if v.status == "new"),
            "learning": sum(1 for v in vendors if v.status == "learning"),
            "confirmed": sum(1 for v in vendors if v.status == "confirmed"),
            "auto_route": sum(1 for v in vendors if v.status == "auto_route"),
        },
        "tiers": {
            "tier1_lookup": t1,
            "tier2_scoring": t2,
            "tier3_llm": t3,
            "human_review": t_human,
        },
        "confidence_distribution": {
            "high_90_100": conf_high,
            "medium_70_90": conf_med,
            "low_50_70": conf_low,
            "very_low_0_50": conf_vlow,
        },
        "entities": entity_stats,
        "recent_decisions": [_decision_to_dict(d) for d in recent],
        "review_queue_count": review_count,
        "system_events": [
            {
                "id": ev.id,
                "event_type": ev.event_type,
                "description": ev.description,
                "metadata": _safe_json(ev.metadata),
                "created_at": ev.created_at.isoformat() if ev.created_at else None,
            }
            for ev in events
        ],
    }


# ── Entities ───────────────────────────────────────────────────────────────────


@app.get("/api/entities")
async def get_entities(
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    entities = db.query(EntityProfile).all()
    return [
        {
            "id": e.id,
            "name": e.name,
            "canonical_name": e.canonical_name,
            "vertical": e.vertical,
            "address_patterns": _safe_json(e.address_patterns),
            "known_vendor_categories": _safe_json(e.known_vendor_categories),
            "po_number_format": e.po_number_format,
            "typical_amount_min": e.typical_amount_min,
            "typical_amount_max": e.typical_amount_max,
            "routing_email": e.routing_email,
            "review_contact": e.review_contact,
            "invoice_count": e.invoice_count,
            "total_routed_amount": e.total_routed_amount,
            "created_at": e.created_at.isoformat() if e.created_at else None,
            "updated_at": e.updated_at.isoformat() if e.updated_at else None,
        }
        for e in entities
    ]


# ── System Events ──────────────────────────────────────────────────────────────


@app.get("/api/system-events")
async def get_system_events(
    limit: int = Query(50, ge=1, le=500),
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    events = (
        db.query(SystemEvent)
        .order_by(SystemEvent.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": ev.id,
            "event_type": ev.event_type,
            "description": ev.description,
            "metadata": _safe_json(ev.metadata),
            "created_at": ev.created_at.isoformat() if ev.created_at else None,
        }
        for ev in events
    ]


# ── Invoice processing ─────────────────────────────────────────────────────────


@app.post("/api/invoices/upload")
async def upload_invoice(
    file: UploadFile = File(...),
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Upload and process an invoice file (PDF, DOCX, image, TXT)."""
    data = await file.read()
    filename = file.filename or "uploaded_invoice"
    content_type = file.content_type

    invoice_file = parse_upload(data, filename, content_type)
    entities = _get_entities_as_dicts(db)
    known_vendors = get_known_vendors_map(db)

    try:
        result = run_pipeline(invoice_file, entities, known_vendors)
    except Exception as exc:
        logger.error("Pipeline error for %s: %s", filename, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Classification pipeline error: {str(exc)}",
        )

    decision = _persist_classification(
        db=db,
        invoice_file=invoice_file,
        result=result,
        source="web_upload",
    )

    return {
        "success": True,
        "decision_id": decision.id,
        "routing_status": result.routing_status,
        "entity_id": result.entity_id,
        "entity_name": result.entity_name,
        "confidence": result.confidence,
        "tier_used": result.tier_used,
        "processing_time_ms": result.processing_time_ms,
        "decision": _decision_to_dict(decision),
    }


@app.post("/api/invoices/process-text")
async def process_text(
    body: ProcessTextRequest,
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Process invoice text pasted directly (no file upload)."""
    invoice_file = InvoiceFile(
        text=body.text,
        filename=body.filename or "pasted_invoice.txt",
    )
    entities = _get_entities_as_dicts(db)
    known_vendors = get_known_vendors_map(db)

    try:
        result = run_pipeline(invoice_file, entities, known_vendors)
    except Exception as exc:
        logger.error("Pipeline error for pasted text: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Classification pipeline error: {str(exc)}",
        )

    decision = _persist_classification(
        db=db,
        invoice_file=invoice_file,
        result=result,
        source="text_paste",
    )

    return {
        "success": True,
        "decision_id": decision.id,
        "routing_status": result.routing_status,
        "entity_id": result.entity_id,
        "entity_name": result.entity_name,
        "confidence": result.confidence,
        "tier_used": result.tier_used,
        "processing_time_ms": result.processing_time_ms,
        "decision": _decision_to_dict(decision),
    }


@app.post("/api/invoices/sample/{sample_id}")
async def process_sample(
    sample_id: str,
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Process one of the built-in sample invoices."""
    sample = next((s for s in SAMPLE_INVOICES if s["id"] == sample_id), None)
    if not sample:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sample invoice '{sample_id}' not found",
        )

    invoice_file = InvoiceFile(
        text=sample["content"],
        filename=f"{sample_id}_{sample['name'].replace(' ', '_')}.txt",
    )
    entities = _get_entities_as_dicts(db)
    known_vendors = get_known_vendors_map(db)

    try:
        result = run_pipeline(invoice_file, entities, known_vendors)
    except Exception as exc:
        logger.error("Pipeline error for sample %s: %s", sample_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Classification pipeline error: {str(exc)}",
        )

    decision = _persist_classification(
        db=db,
        invoice_file=invoice_file,
        result=result,
        source="sample_demo",
        source_metadata={"sample_id": sample_id, "sample_name": sample["name"]},
    )

    return {
        "success": True,
        "sample_id": sample_id,
        "sample_name": sample["name"],
        "decision_id": decision.id,
        "routing_status": result.routing_status,
        "entity_id": result.entity_id,
        "entity_name": result.entity_name,
        "confidence": result.confidence,
        "tier_used": result.tier_used,
        "processing_time_ms": result.processing_time_ms,
        "decision": _decision_to_dict(decision),
    }


# ── Invoice list / detail ──────────────────────────────────────────────────────


@app.get("/api/invoices")
async def list_invoices(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    entity_id: Optional[str] = Query(None),
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Paginated invoice list with optional filters."""
    query = db.query(RoutingDecision).order_by(RoutingDecision.created_at.desc())

    if status_filter:
        query = query.filter(RoutingDecision.routing_status == status_filter)
    if entity_id:
        query = query.filter(RoutingDecision.entity_id == entity_id)

    total = query.count()
    decisions = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
        "items": [_decision_to_dict(d) for d in decisions],
    }


@app.get("/api/invoices/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Get a single routing decision by ID."""
    decision = db.query(RoutingDecision).filter(RoutingDecision.id == invoice_id).first()
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Invoice decision '{invoice_id}' not found",
        )
    return _decision_to_dict(decision)


# ── Review queue ───────────────────────────────────────────────────────────────


@app.get("/api/review-queue")
async def get_review_queue(
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Get review queue items (default: pending only)."""
    query = db.query(ReviewQueue).order_by(ReviewQueue.created_at.desc())

    if status_filter:
        query = query.filter(ReviewQueue.status == status_filter)
    else:
        query = query.filter(ReviewQueue.status == "pending")

    reviews = query.all()
    return [_review_to_dict(r) for r in reviews]


@app.get("/api/review-queue/count")
async def get_review_count(
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Count pending review queue items."""
    count = db.query(ReviewQueue).filter(ReviewQueue.status == "pending").count()
    return {"count": count}


@app.post("/api/review-queue/{review_id}/confirm")
async def confirm_review(
    review_id: str,
    body: ConfirmRoutingRequest,
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Confirm a routing decision from the review queue."""
    try:
        result = confirm_routing(
            review_id=review_id,
            entity_id=body.entity_id,
            confirmed_by=body.confirmed_by or "human_operator",
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error confirming review %s: %s", review_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
    return {"success": True, **result}


@app.post("/api/review-queue/{review_id}/reject")
async def reject_review(
    review_id: str,
    body: RejectRoutingRequest,
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Reject a routing decision from the review queue."""
    try:
        result = reject_routing(
            review_id=review_id,
            reason=body.reason,
            rejected_by=body.rejected_by or "human_operator",
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        logger.error("Error rejecting review %s: %s", review_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
    return {"success": True, **result}


# ── Vendors ────────────────────────────────────────────────────────────────────


@app.get("/api/vendors/stats")
async def get_vendor_stats(
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Aggregate vendor statistics."""
    vendors = db.query(VendorProfile).all()
    return {
        "total": len(vendors),
        "by_status": {
            "new": sum(1 for v in vendors if v.status == "new"),
            "learning": sum(1 for v in vendors if v.status == "learning"),
            "confirmed": sum(1 for v in vendors if v.status == "confirmed"),
            "auto_route": sum(1 for v in vendors if v.status == "auto_route"),
        },
        "by_category": _count_by_field(vendors, "vendor_category"),
        "total_invoices_processed": sum(v.invoice_count or 0 for v in vendors),
        "avg_confirmations_to_auto_route": 3,
    }


@app.get("/api/vendors")
async def list_vendors(
    status_filter: Optional[str] = Query(None, alias="status"),
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """List all vendor profiles."""
    query = db.query(VendorProfile).order_by(VendorProfile.last_seen.desc())
    if status_filter:
        query = query.filter(VendorProfile.status == status_filter)
    vendors = query.all()
    return [_vendor_to_dict(v) for v in vendors]


@app.get("/api/vendors/{vendor_id}")
async def get_vendor(
    vendor_id: str,
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Get a single vendor profile by ID."""
    vendor = db.query(VendorProfile).filter(VendorProfile.id == vendor_id).first()
    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vendor '{vendor_id}' not found",
        )
    return _vendor_to_dict(vendor)


def _vendor_to_dict(v: VendorProfile) -> dict:
    return {
        "id": v.id,
        "canonical_name": v.canonical_name,
        "raw_names": _safe_json(v.raw_names),
        "vendor_category": v.vendor_category,
        "vendor_category_confidence": v.vendor_category_confidence,
        "status": v.status,
        "invoice_count": v.invoice_count,
        "confirmation_count": v.confirmation_count,
        "auto_route_threshold": v.auto_route_threshold,
        "confirmed_entity_id": v.confirmed_entity_id,
        "confirmed_entity_name": v.confirmed_entity_name,
        "typical_amount_min": v.typical_amount_min,
        "typical_amount_max": v.typical_amount_max,
        "typical_amount_avg": v.typical_amount_avg,
        "confidence_history": _safe_json(v.confidence_history),
        "first_seen": v.first_seen.isoformat() if v.first_seen else None,
        "last_seen": v.last_seen.isoformat() if v.last_seen else None,
        "notes": v.notes,
    }


def _count_by_field(items, field: str) -> dict:
    counts: dict[str, int] = {}
    for item in items:
        val = getattr(item, field, None) or "Unknown"
        counts[val] = counts.get(val, 0) + 1
    return counts


# ── Export ─────────────────────────────────────────────────────────────────────


@app.get("/api/export/excel")
async def export_excel(
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Download Excel workbook of all routing data."""
    decisions = db.query(RoutingDecision).order_by(RoutingDecision.created_at.desc()).all()
    vendors = db.query(VendorProfile).all()
    entities = db.query(EntityProfile).all()
    reviews = db.query(ReviewQueue).order_by(ReviewQueue.created_at.desc()).all()

    try:
        excel_bytes = excel_generator.generate_excel_report(
            decisions, vendors, entities, reviews
        )
    except Exception as exc:
        logger.error("Excel generation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Excel generation failed: {str(exc)}",
        )

    filename = f"invoice_routing_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/export/zip")
async def export_zip(
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """Download ZIP archive of all routing data (JSON + Excel)."""
    decisions = db.query(RoutingDecision).order_by(RoutingDecision.created_at.desc()).all()
    vendors = db.query(VendorProfile).all()
    entities = db.query(EntityProfile).all()
    reviews = db.query(ReviewQueue).order_by(ReviewQueue.created_at.desc()).all()
    events = db.query(SystemEvent).order_by(SystemEvent.created_at.desc()).limit(500).all()

    try:
        zip_bytes = zip_generator.generate_zip_export(
            decisions, vendors, entities, reviews, events
        )
    except Exception as exc:
        logger.error("ZIP generation error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ZIP generation failed: {str(exc)}",
        )

    filename = f"invoice_routing_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Sample invoices ────────────────────────────────────────────────────────────


@app.get("/api/samples")
async def list_samples(
    _auth: bool = Depends(auth.require_auth),
):
    """List all built-in sample invoices (without content)."""
    return [
        {
            "id": s["id"],
            "name": s["name"],
            "description": s["description"],
        }
        for s in SAMPLE_INVOICES
    ]


# ── Demo reset ─────────────────────────────────────────────────────────────────


@app.post("/api/demo/reset")
async def demo_reset(
    _auth: bool = Depends(auth.require_auth),
    db: Session = Depends(get_db),
):
    """
    Reset all demo data: clear routing decisions, vendors, review queue,
    and system events. Re-seeds entity profiles.
    """
    db.query(ReviewQueue).delete()
    db.query(RoutingDecision).delete()
    db.query(VendorProfile).delete()
    db.query(SystemEvent).delete()
    db.commit()

    # Re-seed entities (they were deleted too — no, entities are preserved)
    # Actually reset entity counters
    for entity in db.query(EntityProfile).all():
        entity.invoice_count = 0
        entity.total_routed_amount = 0
        entity.updated_at = datetime.utcnow()
    db.commit()

    _log_event(
        db,
        event_type="demo_reset",
        description="Demo data reset — all decisions, vendors, and events cleared",
        metadata={"reset_at": datetime.utcnow().isoformat()},
    )

    return {
        "success": True,
        "message": "Demo data reset successfully. Entity profiles preserved.",
        "timestamp": datetime.utcnow().isoformat(),
    }


# ── Watcher status ─────────────────────────────────────────────────────────────


@app.get("/api/watch-folder/status")
async def watch_folder_status(
    _auth: bool = Depends(auth.require_auth),
):
    """Get folder watcher status."""
    return folder_watcher.get_status()


@app.get("/api/email/status")
async def email_status(
    _auth: bool = Depends(auth.require_auth),
):
    """Get email watcher status."""
    return email_watcher.get_status()


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=os.getenv("RELOAD", "false").lower() == "true",
        log_level="info",
    )
