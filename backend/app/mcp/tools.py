"""MCP tool definitions — JSON Schema specs + async executor functions.

The GLM model calls tools by name; this module provides both the JSON Schema
declarations (for the API request) and the Python callables (for execution).
"""
from __future__ import annotations

from typing import Any

from app.services import supabase_service, lalamove_mock


# ─────────────────────────────────────────
# Tool schemas (passed to GLM API)
# ─────────────────────────────────────────

INTAKE_TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "lookup_product_catalog",
            "description": "Search the product catalog by name or slang alias to resolve ambiguous product references in the buyer's message.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Product name, SKU, or slang alias to search for",
                    },
                    "merchant_id": {"type": "string"},
                },
                "required": ["query", "merchant_id"],
            },
        },
    },
]

INVENTORY_TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_inventory",
            "description": "Get current stock levels and pricing for a specific product by name or product_id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {"type": "string", "description": "Product name to look up"},
                    "merchant_id": {"type": "string"},
                },
                "required": ["product_name", "merchant_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_all_inventory",
            "description": "Get full inventory list to find substitutes when a product is out of stock.",
            "parameters": {
                "type": "object",
                "properties": {"merchant_id": {"type": "string"}},
                "required": ["merchant_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_business_rules",
            "description": "Retrieve business rules (discounts, delivery fees, payment terms) for this merchant.",
            "parameters": {
                "type": "object",
                "properties": {"merchant_id": {"type": "string"}},
                "required": ["merchant_id"],
            },
        },
    },
]

LOGISTICS_TOOLS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "book_lalamove",
            "description": "Book a Lalamove delivery after order is confirmed. Returns tracking URL and ETA.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "string"},
                    "pickup_address": {"type": "string"},
                    "delivery_address": {"type": "string"},
                    "weight_kg": {"type": "number", "description": "Estimated cargo weight in kg"},
                },
                "required": ["order_id", "pickup_address", "delivery_address", "weight_kg"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_order_status",
            "description": "Update the order status in the database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "order_id": {"type": "string"},
                    "status": {
                        "type": "string",
                        "enum": ["Pending", "Awaiting Confirmation", "Confirmed", "Dispatched", "Failed", "Expired"],
                    },
                },
                "required": ["order_id", "status"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "deduct_inventory",
            "description": "Deduct confirmed order quantities from inventory stock.",
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "product_id": {"type": "string"},
                                "quantity": {"type": "integer"},
                            },
                        },
                    }
                },
                "required": ["items"],
            },
        },
    },
]


# ─────────────────────────────────────────
# Tool executor factories
# ─────────────────────────────────────────

def build_intake_executors(merchant_id: str) -> dict[str, Any]:
    async def lookup_product_catalog(query: str, merchant_id: str = merchant_id) -> dict:
        products = await supabase_service.get_products(merchant_id)
        query_lower = query.lower()
        matches = []
        for p in products:
            if (
                query_lower in p.product_name.lower()
                or any(query_lower in alias.lower() for alias in p.slang_aliases)
            ):
                matches.append({
                    "product_id": p.product_id,
                    "product_name": p.product_name,
                    "unit_price": p.unit_price,
                    "stock_quantity": p.stock_quantity,
                    "slang_aliases": p.slang_aliases,
                })
        return {"matches": matches, "total": len(matches)}

    return {"lookup_product_catalog": lookup_product_catalog}


def build_inventory_executors(merchant_id: str) -> dict[str, Any]:
    async def get_inventory(product_name: str, merchant_id: str = merchant_id) -> dict:
        products = await supabase_service.get_products(merchant_id)
        name_lower = product_name.lower()
        for p in products:
            if (
                name_lower in p.product_name.lower()
                or any(name_lower in a.lower() for a in p.slang_aliases)
            ):
                return {
                    "found": True,
                    "product_id": p.product_id,
                    "product_name": p.product_name,
                    "unit_price": p.unit_price,
                    "stock_quantity": p.stock_quantity,
                }
        return {"found": False, "product_name": product_name}

    async def get_all_inventory(merchant_id: str = merchant_id) -> dict:
        products = await supabase_service.get_products(merchant_id)
        return {
            "products": [
                {
                    "product_id": p.product_id,
                    "product_name": p.product_name,
                    "unit_price": p.unit_price,
                    "stock_quantity": p.stock_quantity,
                }
                for p in products
            ]
        }

    async def check_business_rules(merchant_id: str = merchant_id) -> dict:
        rules = await supabase_service.get_knowledge_base_rules(merchant_id)
        return {"business_rules": rules}

    return {
        "get_inventory": get_inventory,
        "get_all_inventory": get_all_inventory,
        "check_business_rules": check_business_rules,
    }


def build_logistics_executors(merchant_id: str, pickup_address: str) -> dict[str, Any]:
    async def book_lalamove(
        order_id: str,
        pickup_address: str = pickup_address,
        delivery_address: str = "",
        weight_kg: float = 5.0,
    ) -> dict:
        quote = await lalamove_mock.get_delivery_quote(pickup_address, delivery_address, weight_kg)
        booking = await lalamove_mock.book_delivery(quote["quote_id"], order_id)
        # Persist to DB
        await supabase_service.create_logistic(
            order_id=order_id,
            provider="Lalamove",
            tracking_url=booking["tracking_url"],
            estimated_price=quote["price_estimate"],
            eta_minutes=quote["eta_minutes"],
        )
        return {**quote, **booking}

    async def update_order_status(order_id: str, status: str) -> dict:
        from app.models.schemas import OrderStatus
        await supabase_service.update_order_status(order_id, OrderStatus(status))
        return {"success": True, "order_id": order_id, "new_status": status}

    async def deduct_inventory(items: list[dict]) -> dict:
        results = []
        for item in items:
            success = await supabase_service.deduct_stock(item["product_id"], item["quantity"])
            results.append({"product_id": item["product_id"], "deducted": success})
        return {"results": results}

    return {
        "book_lalamove": book_lalamove,
        "update_order_status": update_order_status,
        "deduct_inventory": deduct_inventory,
    }
