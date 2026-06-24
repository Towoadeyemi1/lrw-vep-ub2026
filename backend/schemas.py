"""
Pydantic v2 schemas for request/response validation.
"""

from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, ConfigDict


# ─── Entity Schemas ───────────────────────────────────────────────────────────

class EntityProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    canonical_name: str
    vertical: str
    address_patterns: str
    known_vendor_categories: str
    po_number_format: Optional[str] = None
    typical_amount_min: float
    typical_amount_max: float
    routing_email: Optional[str] = None
    review_contact: Optional[str] = None
    invoice_count: int
    total_routed_amount: float
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ─── Vendor Schemas ───────────────────────────────────────────────────────────

class VendorProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    canonical_name: str
    raw_names: str
    vendor_category: Optional[str] = None
    vendor_category_confidence: str
    address_patterns: str
    typical_entities: str
    typical_amount_min: Optional[float] = None
    typical_amount_max: Optional[float] = None
    typical_amount_avg: Optional[float] = None
    invoice_frequency: str
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    invoice_count: int
    confirmed_entity_id: Optional[str] = None
    confirmed_entity_name: Optional[str] = None
    confidence_history: str
    confirmation_count: int
    auto_route_threshold: int
    status: str
    notes: Optional[str] = None


# ─── Routing Decision Schemas ─────────────────────────────────────────────────

class RoutingDecisionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    invoice_filename: Optional[str] = None
    invoice_number: Optional[str] = None
    vendor_name_raw: Optional[str] = None
    vendor_id: Optional[str] = None
    vendor_canonical: Optional[str] = None
    vendor_status_at_time: Optional[str] = None
    entity_id: Optional[str] = None
    entity_name: Optional[str] = None
    entity_vertical: Optional[str] = None
    confidence_score: Optional[float] = None
    tier_used: Optional[str] = None
    routing_status: Optional[str] = None
    extracted_data: str
    signals_matched: str
    llm_reasoning: Optional[str] = None
    top_candidates: str
    amount: Optional[float] = None
    currency: str
    invoice_date: Optional[str] = None
    po_number: Optional[str] = None
    line_items: str
    human_confirmed_by: Optional[str] = None
    human_confirmed_at: Optional[datetime] = None
    human_override_entity_id: Optional[str] = None
    processing_time_ms: Optional[int] = None
    source: str
    source_metadata: str
    created_at: Optional[datetime] = None


# ─── Review Queue Schemas ─────────────────────────────────────────────────────

class ReviewQueueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    routing_decision_id: str
    top_candidates: str
    invoice_filename: Optional[str] = None
    vendor_name: Optional[str] = None
    amount: Optional[float] = None
    extracted_data: str
    priority: str
    status: str
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None


# ─── System Event Schemas ─────────────────────────────────────────────────────

class SystemEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    event_type: str
    description: Optional[str] = None
    metadata: str
    created_at: Optional[datetime] = None


# ─── Request Bodies ───────────────────────────────────────────────────────────

class ProcessTextRequest(BaseModel):
    text: str
    filename: Optional[str] = "pasted_invoice.txt"


class ConfirmRoutingRequest(BaseModel):
    entity_id: str
    confirmed_by: Optional[str] = "human_operator"


class RejectRoutingRequest(BaseModel):
    reason: Optional[str] = None
    rejected_by: Optional[str] = "human_operator"


# ─── Dashboard Schema ─────────────────────────────────────────────────────────

class DashboardTotals(BaseModel):
    invoices_processed: int = 0
    auto_routed: int = 0
    auto_routed_pct: float = 0.0
    human_review: int = 0
    escalated: int = 0
    confirmed: int = 0
    total_amount_processed: float = 0.0


class DashboardVendors(BaseModel):
    total: int = 0
    new: int = 0
    learning: int = 0
    confirmed: int = 0
    auto_route: int = 0


class DashboardTiers(BaseModel):
    tier1_lookup: int = 0
    tier2_scoring: int = 0
    tier3_llm: int = 0
    human_review: int = 0


class DashboardConfidenceDistribution(BaseModel):
    high_90_100: int = 0
    medium_70_90: int = 0
    low_50_70: int = 0
    very_low_0_50: int = 0


class DashboardResponse(BaseModel):
    totals: DashboardTotals
    vendors: DashboardVendors
    tiers: DashboardTiers
    confidence_distribution: DashboardConfidenceDistribution
    entities: list[dict[str, Any]]
    recent_decisions: list[dict[str, Any]]
    review_queue_count: int
    system_events: list[dict[str, Any]]
