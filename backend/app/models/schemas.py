"""Pydantic models for inter-agent data exchange and API contracts."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


# ─────────────────────────────────────────
# Enums
# ─────────────────────────────────────────

class OrderStatus(str, Enum):
    PENDING = "Pending"
    AWAITING_SUBSTITUTION = "Awaiting Substitution"
    AWAITING_CONFIRMATION = "Awaiting Confirmation"
    CONFIRMED = "Confirmed"
    DISPATCHED = "Dispatched"
    FAILED = "Failed"
    EXPIRED = "Expired"


class MessageType(str, Enum):
    TEXT = "text"
    AUDIO = "audio"
    IMAGE = "image"
    SYSTEM = "system"


class SenderType(str, Enum):
    BUYER = "buyer"
    SYSTEM = "system"
    AGENT = "agent"


# ─────────────────────────────────────────
# Incoming webhook payload
# ─────────────────────────────────────────

class IncomingMessage(BaseModel):
    from_number: str
    message_type: MessageType
    text_content: Optional[str] = None
    media_url: Optional[str] = None       # Twilio media URL
    merchant_id: str


# ─────────────────────────────────────────
# Agent handoff models
# ─────────────────────────────────────────

class OrderLineItem(BaseModel):
    product_name: str
    quantity: int
    unit: Optional[str] = None


class IntakeResult(BaseModel):
    """Output from Intake Agent (GLM-5.1)."""
    intent: str = Field(description="order | inquiry | complaint | other")
    items: list[OrderLineItem] = Field(default_factory=list)
    delivery_address: Optional[str] = None
    language_detected: str = "mixed"
    confidence: float = Field(ge=0.0, le=1.0)
    clarification_needed: bool = False
    clarification_message: Optional[str] = None
    references_previous_order: bool = Field(default=False, description="True if buyer references a past order (e.g. 'same as yesterday', 'macam semalam')")
    notes: Optional[str] = None


class ResolvedOrderItem(BaseModel):
    product_id: str
    product_name: str
    original_product_name: Optional[str] = None  # set when is_substituted=True
    requested_qty: int
    fulfilled_qty: int
    unit_price: float
    line_total: float
    is_substituted: bool = False
    discount_pct: Optional[float] = None          # discount % offered for substitution
    substitute_reason: Optional[str] = None


class InventoryResult(BaseModel):
    """Output from Inventory & Logic Agent (GLM-5.1)."""
    order_feasible: bool
    items: list[ResolvedOrderItem] = Field(default_factory=list)
    total_amount: float
    discount_applied: float = 0.0
    delivery_fee: float = 15.0
    grand_total: float
    quote_message: str = ""
    out_of_stock_items: list[str] = Field(default_factory=list)
    requires_substitution: bool = False
    notes: Optional[str] = None


class LogisticsResult(BaseModel):
    """Output from Logistics Agent (GLM-4.7-Flash)."""
    booking_reference: str
    provider: str = "Lalamove"
    tracking_url: str
    estimated_price: float
    eta_minutes: int
    confirmation_message: str


# ─────────────────────────────────────────
# DB row shapes (returned from Supabase)
# ─────────────────────────────────────────

class CustomerRow(BaseModel):
    customer_id: str
    customer_name: str
    whatsapp_number: str
    delivery_address: Optional[str] = None
    merchant_id: str


class ProductRow(BaseModel):
    product_id: str
    product_name: str
    product_sku: Optional[str] = None
    unit_price: float
    stock_quantity: int
    slang_aliases: list[str] = Field(default_factory=list)
    merchant_id: str


class OrderRow(BaseModel):
    order_id: str
    customer_id: str
    merchant_id: str
    order_amount: Optional[float] = None
    order_status: OrderStatus
    order_notes: Optional[str] = None
    confidence_score: Optional[float] = None
    requires_human_review: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ─────────────────────────────────────────
# Dashboard API responses
# ─────────────────────────────────────────

class OrderDetail(BaseModel):
    order_id: str
    customer_name: str
    whatsapp_number: str
    order_status: OrderStatus
    order_amount: Optional[float] = None
    requires_human_review: bool = False
    confidence_score: Optional[float] = None
    items: list[dict] = Field(default_factory=list)
    created_at: Optional[datetime] = None


class DashboardStats(BaseModel):
    total_today: int
    pending: int
    awaiting_substitution: int
    awaiting_confirmation: int
    confirmed: int
    dispatched: int
    failed: int
    requires_review: int
