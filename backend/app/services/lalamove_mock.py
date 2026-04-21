"""Lalamove logistics integration — structurally-correct mock for MVP demo."""
from __future__ import annotations

import logging
import random
import string
import uuid

logger = logging.getLogger(__name__)

# Realistic mock data pool
_VEHICLE_TYPES = ["Motorcycle", "Car", "Van", "Lorry 1-Tonne"]
_PRICE_BY_VEHICLE = {"Motorcycle": 12.0, "Car": 18.0, "Van": 35.0, "Lorry 1-Tonne": 65.0}
_ETA_BY_VEHICLE = {"Motorcycle": 20, "Car": 30, "Van": 45, "Lorry 1-Tonne": 60}


async def get_delivery_quote(
    pickup_address: str,
    delivery_address: str,
    weight_kg: float,
) -> dict:
    """Return a realistic mock Lalamove quote response."""
    vehicle = "Motorcycle" if weight_kg < 5 else ("Van" if weight_kg < 50 else "Lorry 1-Tonne")
    base_price = _PRICE_BY_VEHICLE[vehicle]
    # Simple distance-based jitter
    price_estimate = round(base_price + random.uniform(-2, 5), 2)
    eta = _ETA_BY_VEHICLE[vehicle] + random.randint(-5, 15)

    quote_id = "QUO-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
    logger.info("[MOCK Lalamove] Quote %s: %s → RM%.2f, ETA %dm", quote_id, vehicle, price_estimate, eta)

    return {
        "quote_id": quote_id,
        "vehicle_type": vehicle,
        "price_estimate": price_estimate,
        "currency": "MYR",
        "eta_minutes": eta,
        "pickup_address": pickup_address,
        "delivery_address": delivery_address,
    }


async def book_delivery(quote_id: str, order_reference: str) -> dict:
    """Confirm booking from a prior quote. Returns order confirmation with tracking."""
    delivery_id = str(uuid.uuid4())
    tracking_code = "LAL-" + "".join(random.choices(string.digits, k=9))
    tracking_url = f"https://web.lalamove.com/tracking/{tracking_code}"

    logger.info("[MOCK Lalamove] Booked delivery %s, tracking: %s", delivery_id, tracking_url)

    return {
        "delivery_id": delivery_id,
        "order_reference": order_reference,
        "status": "ASSIGNING_DRIVER",
        "tracking_code": tracking_code,
        "tracking_url": tracking_url,
        "message": "Driver assignment in progress. You will be notified once a driver accepts.",
    }
