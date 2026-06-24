"""
SQLAlchemy ORM models for Invoice Routing Intelligence.
"""

from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Text, DateTime, Boolean
)
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class EntityProfile(Base):
    __tablename__ = "entity_profiles"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    canonical_name = Column(String, nullable=False)
    vertical = Column(String, nullable=False)
    address_patterns = Column(Text, default="[]")
    known_vendor_categories = Column(Text, default="[]")
    po_number_format = Column(String, nullable=True)
    typical_amount_min = Column(Float, default=0)
    typical_amount_max = Column(Float, default=999999)
    routing_email = Column(String, nullable=True)
    review_contact = Column(String, nullable=True)
    invoice_count = Column(Integer, default=0)
    total_routed_amount = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class VendorProfile(Base):
    __tablename__ = "vendor_profiles"

    id = Column(String, primary_key=True)
    canonical_name = Column(String, nullable=False, unique=True)
    raw_names = Column(Text, nullable=False, default="[]")
    vendor_category = Column(String, nullable=True)
    vendor_category_confidence = Column(String, default="low")
    address_patterns = Column(Text, default="[]")
    typical_entities = Column(Text, default="[]")
    typical_amount_min = Column(Float, nullable=True)
    typical_amount_max = Column(Float, nullable=True)
    typical_amount_avg = Column(Float, nullable=True)
    invoice_frequency = Column(String, default="unknown")
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)
    invoice_count = Column(Integer, default=1)
    confirmed_entity_id = Column(String, nullable=True)
    confirmed_entity_name = Column(String, nullable=True)
    confidence_history = Column(Text, default="[]")
    confirmation_count = Column(Integer, default=0)
    auto_route_threshold = Column(Integer, default=3)
    status = Column(String, default="new")
    notes = Column(Text, nullable=True)


class RoutingDecision(Base):
    __tablename__ = "routing_decisions"

    id = Column(String, primary_key=True)
    invoice_filename = Column(String, nullable=True)
    invoice_number = Column(String, nullable=True)
    vendor_name_raw = Column(String, nullable=True)
    vendor_id = Column(String, nullable=True)
    vendor_canonical = Column(String, nullable=True)
    vendor_status_at_time = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    entity_name = Column(String, nullable=True)
    entity_vertical = Column(String, nullable=True)
    confidence_score = Column(Float, nullable=True)
    tier_used = Column(String, nullable=True)
    routing_status = Column(String, nullable=True)
    extracted_data = Column(Text, default="{}")
    signals_matched = Column(Text, default="[]")
    llm_reasoning = Column(Text, nullable=True)
    top_candidates = Column(Text, default="[]")
    amount = Column(Float, nullable=True)
    currency = Column(String, default="USD")
    invoice_date = Column(String, nullable=True)
    po_number = Column(String, nullable=True)
    line_items = Column(Text, default="[]")
    human_confirmed_by = Column(String, nullable=True)
    human_confirmed_at = Column(DateTime, nullable=True)
    human_override_entity_id = Column(String, nullable=True)
    processing_time_ms = Column(Integer, nullable=True)
    source = Column(String, default="web_upload")
    source_metadata = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)


class ReviewQueue(Base):
    __tablename__ = "review_queue"

    id = Column(String, primary_key=True)
    routing_decision_id = Column(String, nullable=False, unique=True)
    top_candidates = Column(Text, nullable=False, default="[]")
    invoice_filename = Column(String, nullable=True)
    vendor_name = Column(String, nullable=True)
    amount = Column(Float, nullable=True)
    extracted_data = Column(Text, default="{}")
    priority = Column(String, default="normal")
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(String, nullable=True)


class SystemEvent(Base):
    __tablename__ = "system_events"

    id = Column(String, primary_key=True)
    event_type = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    metadata = Column(Text, default="{}")
    created_at = Column(DateTime, default=datetime.utcnow)
