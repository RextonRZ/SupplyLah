"""Standardised product-clarification message renderer.

All buyer-facing text for the product disambiguation flow lives here.
Templates are documented in app/prompts/clarification_prompt.md.
"""
from __future__ import annotations


def _list_row(n: int, product_name: str, unit_price: float, unit: str | None) -> str:
    u = unit or "unit"
    return f"  {n}. {product_name} — RM{unit_price}/{u}"


def _footer(lang: str) -> str:
    return "\nBalas dengan nombor pilihan anda." if lang == "ms" else "\nReply with the number of your choice."


def _cancel_label(lang: str) -> str:
    return "Batal pesanan" if lang == "ms" else "Cancel order"


def build_ask_message(
    *,
    raw_name: str,
    candidates: list,          # list[ProductRow] or list[dict] with product_name/unit_price/unit
    lang: str,
    header_variant: str = "ambiguous",  # "clarification_needed" | "ambiguous" | "next_item"
) -> str:
    """Build the first-time disambiguation numbered list.

    header_variant controls the opening line:
      - "clarification_needed": buyer message was too vague, no items parsed
      - "ambiguous": hybrid resolver found a match but confidence is low
      - "next_item": asking about the next item in a multi-item order
    """
    if header_variant == "clarification_needed":
        header = (
            "Boleh tahu barang yang anda inginkan? Kami ada stok untuk:"
            if lang == "ms" else
            "Which product did you mean? We have these in stock:"
        )
    elif header_variant == "next_item":
        header = (
            f"Terima kasih! \"{raw_name}\" yang mana satu? Pilih yang ada stok:"
            if lang == "ms" else
            f"Thanks! Which \"{raw_name}\" do you mean? Available in stock:"
        )
    else:  # ambiguous
        header = (
            f"\"{raw_name}\" yang mana satu? Pilih yang ada stok:"
            if lang == "ms" else
            f"Which \"{raw_name}\" do you mean? Available in stock:"
        )

    lines = [header]
    for i, c in enumerate(candidates, 1):
        if isinstance(c, dict):
            name, price, unit = c["product_name"], c["unit_price"], c.get("unit")
        else:
            name, price, unit = c.product_name, c.unit_price, c.unit
        lines.append(_list_row(i, name, price, unit))
    lines.append(f"  {len(candidates) + 1}. {_cancel_label(lang)}")
    lines.append(_footer(lang))
    return "\n".join(lines)


def build_retry_message(
    *,
    raw_name: str,
    candidates: list,          # list[dict] — stored in order_notes
    lang: str,
) -> str:
    """Re-ask after an unrecognised reply."""
    header = (
        f"Maaf, saya tak faham. Cuba lagi — \"{raw_name}\" yang mana satu?"
        if lang == "ms" else
        f"Sorry, I didn't get that. Try again — which \"{raw_name}\" do you mean?"
    )
    lines = [header, ""]
    for i, c in enumerate(candidates, 1):
        if isinstance(c, dict):
            name, price, unit = c["product_name"], c["unit_price"], c.get("unit")
        else:
            name, price, unit = c.product_name, c.unit_price, c.unit
        lines.append(_list_row(i, name, price, unit))
    lines.append(f"  {len(candidates) + 1}. {_cancel_label(lang)}")
    lines.append(_footer(lang))
    return "\n".join(lines)


def build_cancelled_by_buyer(lang: str) -> str:
    if lang == "ms":
        return "Ok, pesanan dibatalkan. Boleh buat pesanan baru bila-bila masa! 😊"
    return "Ok, order cancelled. Feel free to place a new order anytime! 😊"


def build_cancelled_max_retries(lang: str) -> str:
    if lang == "ms":
        return (
            "Maaf, saya tidak dapat memahami pilihan anda. Pesanan dibatalkan. "
            "Boleh cuba semula bila-bila masa! 😊"
        )
    return (
        "Sorry, I couldn't understand your choice. Order cancelled. "
        "Feel free to try again anytime! 😊"
    )


def build_no_stock(raw_name: str, lang: str) -> str:
    if lang == "ms":
        return (
            f"Maaf, \"{raw_name}\" tiada stok buat masa ini 😔 "
            "Staf kami akan semak dan hubungi anda tidak lama lagi!"
        )
    return (
        f"Sorry, \"{raw_name}\" is currently out of stock 😔 "
        "Our staff will follow up with you shortly!"
    )


def build_ask_quantity(product_name: str, unit: str | None, lang: str) -> str:
    """Ask for quantity when the product is known but quantity is missing."""
    u = unit or "unit"
    if lang == "ms":
        return f"Boleh tahu berapa {u} {product_name} yang anda perlukan? 😊"
    return f"How many {u} of {product_name} do you need? 😊"


def build_no_match(lang: str) -> str:
    if lang == "ms":
        return "Boleh nyatakan semula pesanan anda? Saya mahu pastikan segalanya betul!"
    return "Could you please clarify your order? I want to make sure I get it right!"
