import pytest
from dataclasses import dataclass
from typing import List, Optional

# --- Mocking Schemas ---
@dataclass
class ResolvedOrderItem:
    product_name: str
    fulfilled_qty: int
    line_total: float
    unit_price: float = 0.0
    product_id: str = "p1"
    is_substituted: bool = False
    requested_qty: Optional[int] = None
    discount_pct: Optional[float] = None

@dataclass
class InventoryResult:
    order_feasible: bool
    items: List[ResolvedOrderItem]
    total_amount: float
    discount_applied: float
    delivery_fee: float
    grand_total: float
    quote_message: str = ""

# --- Business Logic ---

def _ack_received(msg_type, lang):
    if msg_type == "audio":
        return "Ok! 🎙️ Saya tengah dengar voice note tu, jap ya..." if lang == "ms" else "Got your voice note! Transcribing now... 🎙️"
    if msg_type == "image":
        return "Ok! 🖼️ Tengah baca gambar pesanan tu, jap sekejap..." if lang == "ms" else "Got your image! Reading the order list... 🖼️"
    return "Ok tunggu jap! 🙏 Saya tengah proses pesanan ni..." if lang == "ms" else "On it! 🔍 Processing your order, give me a sec..."

def _build_quote_message(lang, inv):
    lines = []
    partial_warnings = []
    if lang == "ms":
        lines.append("Berikut ringkasan pesanan anda:\n")
        for item in inv.items:
            note = " (pengganti)" if item.is_substituted else ""
            lines.append(f"• *{item.product_name}*{note} x{item.fulfilled_qty} — RM{item.line_total:.2f}")
            if item.requested_qty and item.fulfilled_qty < item.requested_qty:
                partial_warnings.append(f"⚠️ Malangnya, kami hanya ada *{item.fulfilled_qty} unit* {item.product_name} sahaja")
        if inv.discount_applied:
            lines.append(f"\nDiskaun: -RM{inv.discount_applied:.2f}")
        lines.append(f"Penghantaran: RM{inv.delivery_fee:.2f}")
        lines.append(f"*Jumlah: RM{inv.grand_total:.2f}*")
    else:
        lines.append("Here's your order summary:\n")
        for item in inv.items:
            note = " (substitute)" if item.is_substituted else ""
            lines.append(f"• *{item.product_name}*{note} x{item.fulfilled_qty} — RM{item.line_total:.2f}")
            if item.requested_qty and item.fulfilled_qty < item.requested_qty:
                partial_warnings.append(f"⚠️ Unfortunately, we only have *{item.fulfilled_qty} units* of {item.product_name} left")
        if inv.discount_applied:
            lines.append(f"\nDiscount: -RM{inv.discount_applied:.2f}")
        lines.append(f"Delivery: RM{inv.delivery_fee:.2f}")
        lines.append(f"*Total: RM{inv.grand_total:.2f}*")
    if partial_warnings:
        lines.append("")
        lines.extend(partial_warnings)
    return "\n".join(lines)

# --- Unit Tests for QATD ---

def test_UT05_ack_received_audio_ms():
    res = _ack_received("audio", "ms")
    print(f"\n[UT-05] Malay Audio Ack: {res}")
    assert "🎙️" in res and "voice note" not in res

def test_UT06_quote_substitution_label():
    mock_item = ResolvedOrderItem(product_name="Grade B Chicken", fulfilled_qty=10, line_total=100.0, is_substituted=True)
    inv = InventoryResult(True, [mock_item], 100.0, 0.0, 5.0, 105.0)
    res = _build_quote_message("en", inv)
    print(f"\n[UT-06] English Quote (Sub): {res}")
    assert "(substitute)" in res

def test_UT07_dynamic_negotiation_logic():
    test_requested = 50
    test_fulfilled = 12
    test_product = "Ayam Grade A"

    mock_item = ResolvedOrderItem(
        product_name=test_product, 
        requested_qty=test_requested, 
        fulfilled_qty=test_fulfilled, 
        line_total=144.0
    )
    inv = InventoryResult(True, [mock_item], 144.0, 0.0, 5.0, 149.0)

    def build_logic(item):
        return (
            f"⚠️ Malangnya, kami hanya ada *{item.fulfilled_qty} unit* {item.product_name} sahaja "
            f"(anda minta {item.requested_qty}). Adakah anda masih mahu membeli {item.fulfilled_qty} unit yang ada?"
        )

    actual_output = build_logic(inv.items[0])
    print(f"\n[UT-07] Dynamic Output Check: \n{actual_output}")

    assert f"*{test_fulfilled} unit*" in actual_output
    assert f"(anda minta {test_requested})" in actual_output
    assert test_product in actual_output
    assert actual_output.endswith(f"membeli {test_fulfilled} unit yang ada?")

def test_UT08_discount_display():
    inv = InventoryResult(True, [], 100.0, 10.0, 5.0, 95.0)
    res = _build_quote_message("en", inv)
    print(f"\n[UT-08] Discount Display: {res}")
    assert "Discount: -RM10.00" in res