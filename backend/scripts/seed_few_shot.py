"""Seed few-shot examples into Supabase for dynamic intake retrieval.

Examples are grounded in authentic Malaysian wholesale language patterns
sourced from the Mesolitica Malaysian Dataset (mesolitica/malaysian-dataset)
— specifically their Twitter/social-media and conversational corpora —
and adapted to the SME wholesale ordering context.

Reference: https://github.com/mesolitica/malaysian-dataset

Run from the backend directory:
    python -m scripts.seed_few_shot
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Allow running as a script from the backend directory
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

# ---------------------------------------------------------------------------
# 80 grounded examples
# Each entry: (raw_message, parsed_output_dict)
# Products map to the demo catalog:
#   Minyak Masak 5L · Beras Tempatan 10kg · Gula Pasir 1kg · Tepung Gandum 1kg
#   Sardin 425g · Mee Segera 30pcs · Susu Cair 1L · Kicap Manis 625ml
# ---------------------------------------------------------------------------

EXAMPLES: list[tuple[str, dict]] = [
    # ── Heavy Bahasa Rojak slang orders (1-15) ─────────────────────────────
    (
        "boss nk order 5 guni beras, 3 ctn maggi hntar esok kl",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 5, "unit": "karung"}, {"product_name": "Mee Segera 30pcs", "quantity": 3, "unit": "kotak"}], "delivery_address": "KL", "language_detected": "mixed", "confidence": 0.88, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "esok = tomorrow delivery requested"},
    ),
    (
        "slm boss nk amik minyak 10 btl gula 20 beg bole?",
        {"intent": "order", "items": [{"product_name": "Minyak Masak 5L", "quantity": 10, "unit": "botol"}, {"product_name": "Gula Pasir 1kg", "quantity": 20, "unit": "beg"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.93, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "bos sy nk order beras 2 guni. anta ke jln tun hussein ok",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 2, "unit": "karung"}], "delivery_address": "Jalan Tun Hussein", "language_detected": "malay", "confidence": 0.95, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "salam sy nk 50 tin sardin ngan 30 pkt tepung bile blh anta?",
        {"intent": "order", "items": [{"product_name": "Sardin 425g", "quantity": 50, "unit": "tin"}, {"product_name": "Tepung Gandum 1kg", "quantity": 30, "unit": "peket"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.91, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "buyer asking for delivery timeline"},
    ),
    (
        "boss mee sgt kurang stok skrg nk order 100 pkt",
        {"intent": "order", "items": [{"product_name": "Mee Segera 30pcs", "quantity": 100, "unit": "peket"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.89, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "urgent restock"},
    ),
    (
        "pagi boss nk 5L minyak masak dgn 2kg gula urgent skit",
        {"intent": "order", "items": [{"product_name": "Minyak Masak 5L", "quantity": 1, "unit": "botol"}, {"product_name": "Gula Pasir 1kg", "quantity": 2, "unit": "beg"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.87, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "urgent order; 5L likely refers to 1 bottle of Minyak Masak 5L"},
    ),
    (
        "bro nk order maggi kari 5 kotak susu 3 kotak blh antar ptg ni?",
        {"intent": "order", "items": [{"product_name": "Mee Segera 30pcs", "quantity": 5, "unit": "kotak"}, {"product_name": "Susu Cair 1L", "quantity": 3, "unit": "kotak"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.86, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "maggi kari resolved to Mee Segera; afternoon delivery requested"},
    ),
    (
        "tuan nk amik beras 3 karung ngan minyak 5 botol hrg same ke?",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 3, "unit": "karung"}, {"product_name": "Minyak Masak 5L", "quantity": 5, "unit": "botol"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.9, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "buyer asking if price is same as before"},
    ),
    (
        "nk order la 20 tin sardin cap ayam 10 pkt gula",
        {"intent": "order", "items": [{"product_name": "Sardin 425g", "quantity": 20, "unit": "tin"}, {"product_name": "Gula Pasir 1kg", "quantity": 10, "unit": "peket"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.88, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "cap ayam is a brand alias for sardine"},
    ),
    (
        "boss pls la cpt skit anta kicap 5 btl minyak 10 btl kedai da nk buka",
        {"intent": "order", "items": [{"product_name": "Kicap Manis 625ml", "quantity": 5, "unit": "botol"}, {"product_name": "Minyak Masak 5L", "quantity": 10, "unit": "botol"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.92, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "urgent — shop opening soon"},
    ),
    (
        "salam restoran sy nk tambah stok minyak 20L beras 50kg gula 10kg",
        {"intent": "order", "items": [{"product_name": "Minyak Masak 5L", "quantity": 4, "unit": "botol"}, {"product_name": "Beras Tempatan 10kg", "quantity": 5, "unit": "beg"}, {"product_name": "Gula Pasir 1kg", "quantity": 10, "unit": "beg"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.87, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "20L minyak = 4 x 5L bottles; 50kg beras = 5 x 10kg bags"},
    ),
    (
        "bos nk repeat order mcm last week 5 guni beras 3 ctn mee",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 5, "unit": "karung"}, {"product_name": "Mee Segera 30pcs", "quantity": 3, "unit": "kotak"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.85, "clarification_needed": False, "clarification_message": None, "references_previous_order": True, "notes": None},
    ),
    (
        "boss urgent! nk 100 btl kicap manis anta ptg ni blh?",
        {"intent": "order", "items": [{"product_name": "Kicap Manis 625ml", "quantity": 100, "unit": "botol"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.94, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "urgent bulk order"},
    ),
    (
        "nk 2 karung beras setgh kotak susu 3 beg tepung tq",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 2, "unit": "karung"}, {"product_name": "Susu Cair 1L", "quantity": 1, "unit": "kotak"}, {"product_name": "Tepung Gandum 1kg", "quantity": 3, "unit": "beg"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.84, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "setgh kotak = half a box, interpreted as 1 box"},
    ),
    (
        "boss sy nk amik stok baru beras 30kg minyak 15L gula 5kg",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 3, "unit": "beg"}, {"product_name": "Minyak Masak 5L", "quantity": 3, "unit": "botol"}, {"product_name": "Gula Pasir 1kg", "quantity": 5, "unit": "beg"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.9, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "quantities converted from bulk weight to product units"},
    ),

    # ── Mixed English-Malay (Bahasa Rojak) orders (16-30) ──────────────────
    (
        "hi boss want to order 10 bottles minyak masak and 5 bags gula ok?",
        {"intent": "order", "items": [{"product_name": "Minyak Masak 5L", "quantity": 10, "unit": "botol"}, {"product_name": "Gula Pasir 1kg", "quantity": 5, "unit": "beg"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.95, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "good morning need restock 3 cartons maggi 2 cartons susu",
        {"intent": "order", "items": [{"product_name": "Mee Segera 30pcs", "quantity": 3, "unit": "kotak"}, {"product_name": "Susu Cair 1L", "quantity": 2, "unit": "kotak"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.92, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "boss I need 50 tin sardin and 20 pack tepung by tomorrow",
        {"intent": "order", "items": [{"product_name": "Sardin 425g", "quantity": 50, "unit": "tin"}, {"product_name": "Tepung Gandum 1kg", "quantity": 20, "unit": "peket"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.94, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "tomorrow delivery requested"},
    ),
    (
        "order please minyak 5L x10 beras 10kg x5 gula 1kg x20",
        {"intent": "order", "items": [{"product_name": "Minyak Masak 5L", "quantity": 10, "unit": "botol"}, {"product_name": "Beras Tempatan 10kg", "quantity": 5, "unit": "beg"}, {"product_name": "Gula Pasir 1kg", "quantity": 20, "unit": "beg"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.96, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "hi can i order 30 packs instant noodle and 10 bottles soy sauce",
        {"intent": "order", "items": [{"product_name": "Mee Segera 30pcs", "quantity": 30, "unit": "peket"}, {"product_name": "Kicap Manis 625ml", "quantity": 10, "unit": "botol"}], "delivery_address": None, "language_detected": "english", "confidence": 0.93, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "nk order la boss 2 kotak mee segera 3 tin sardin delivery tomorrow?",
        {"intent": "order", "items": [{"product_name": "Mee Segera 30pcs", "quantity": 2, "unit": "kotak"}, {"product_name": "Sardin 425g", "quantity": 3, "unit": "tin"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.91, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "tomorrow delivery requested"},
    ),
    (
        "good afternoon want to add stock rice 3 sacks cooking oil 20 bottles",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 3, "unit": "karung"}, {"product_name": "Minyak Masak 5L", "quantity": 20, "unit": "botol"}], "delivery_address": None, "language_detected": "english", "confidence": 0.95, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "bro need maggi 5 boxes and fresh milk 3 boxes same price?",
        {"intent": "order", "items": [{"product_name": "Mee Segera 30pcs", "quantity": 5, "unit": "kotak"}, {"product_name": "Susu Cair 1L", "quantity": 3, "unit": "kotak"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.88, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "buyer checking if price unchanged"},
    ),
    (
        "order lah kicap 10 btl minyak 5 btl tepung 3 beg total brape?",
        {"intent": "order", "items": [{"product_name": "Kicap Manis 625ml", "quantity": 10, "unit": "botol"}, {"product_name": "Minyak Masak 5L", "quantity": 5, "unit": "botol"}, {"product_name": "Tepung Gandum 1kg", "quantity": 3, "unit": "beg"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.9, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "buyer wants total price quote"},
    ),
    (
        "hi i want beras tempatan 20kg minyak masak 10L sugar 5kg please",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 2, "unit": "beg"}, {"product_name": "Minyak Masak 5L", "quantity": 2, "unit": "botol"}, {"product_name": "Gula Pasir 1kg", "quantity": 5, "unit": "beg"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.93, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "boss need stock urgently 100 packs mee 50 tins sardine 20 bottles oil",
        {"intent": "order", "items": [{"product_name": "Mee Segera 30pcs", "quantity": 100, "unit": "peket"}, {"product_name": "Sardin 425g", "quantity": 50, "unit": "tin"}, {"product_name": "Minyak Masak 5L", "quantity": 20, "unit": "botol"}], "delivery_address": None, "language_detected": "english", "confidence": 0.94, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "urgent bulk order"},
    ),
    (
        "morning nak order rice 2 sacks and cooking oil 1 box delivery kl area",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 2, "unit": "karung"}, {"product_name": "Minyak Masak 5L", "quantity": 1, "unit": "kotak"}], "delivery_address": "KL", "language_detected": "mixed", "confidence": 0.91, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "nk 5 kotak susu fresh and 3 beg tepung whats the price?",
        {"intent": "order", "items": [{"product_name": "Susu Cair 1L", "quantity": 5, "unit": "kotak"}, {"product_name": "Tepung Gandum 1kg", "quantity": 3, "unit": "beg"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.89, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "buyer wants price before confirming"},
    ),
    (
        "order 10 botol kicap 5 beg gula 2 kotak mee deliver esok boleh?",
        {"intent": "order", "items": [{"product_name": "Kicap Manis 625ml", "quantity": 10, "unit": "botol"}, {"product_name": "Gula Pasir 1kg", "quantity": 5, "unit": "beg"}, {"product_name": "Mee Segera 30pcs", "quantity": 2, "unit": "kotak"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.92, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "tomorrow delivery"},
    ),
    (
        "hi boss restocking minyak 10 btl beras 1 guni sardin 2 dozen",
        {"intent": "order", "items": [{"product_name": "Minyak Masak 5L", "quantity": 10, "unit": "botol"}, {"product_name": "Beras Tempatan 10kg", "quantity": 1, "unit": "karung"}, {"product_name": "Sardin 425g", "quantity": 24, "unit": "tin"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.88, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "2 dozen = 24 tins"},
    ),

    # ── Formal Bahasa Melayu (31-40) ───────────────────────────────────────
    (
        "Salam saya ingin membuat pesanan untuk 5 botol minyak masak dan 10 beg gula pasir",
        {"intent": "order", "items": [{"product_name": "Minyak Masak 5L", "quantity": 5, "unit": "botol"}, {"product_name": "Gula Pasir 1kg", "quantity": 10, "unit": "beg"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.97, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "Selamat pagi boleh saya dapatkan 3 karung beras tempatan dan 2 kotak mee segera?",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 3, "unit": "karung"}, {"product_name": "Mee Segera 30pcs", "quantity": 2, "unit": "kotak"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.96, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "Saya hendak memesan 20 tin sardin dan 10 beg tepung gandum untuk kedai saya",
        {"intent": "order", "items": [{"product_name": "Sardin 425g", "quantity": 20, "unit": "tin"}, {"product_name": "Tepung Gandum 1kg", "quantity": 10, "unit": "beg"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.97, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "Boleh saya tanya adakah stok kicap manis masih ada? Saya nak order 15 botol",
        {"intent": "order", "items": [{"product_name": "Kicap Manis 625ml", "quantity": 15, "unit": "botol"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.9, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "buyer asking about stock availability before ordering"},
    ),
    (
        "Pesanan saya: susu cair 20 kotak, gula pasir 10 beg, minyak masak 5 botol",
        {"intent": "order", "items": [{"product_name": "Susu Cair 1L", "quantity": 20, "unit": "kotak"}, {"product_name": "Gula Pasir 1kg", "quantity": 10, "unit": "beg"}, {"product_name": "Minyak Masak 5L", "quantity": 5, "unit": "botol"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.98, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "Assalamualaikum nak buat pesanan untuk restoran. Minyak 20L dan beras 50kg",
        {"intent": "order", "items": [{"product_name": "Minyak Masak 5L", "quantity": 4, "unit": "botol"}, {"product_name": "Beras Tempatan 10kg", "quantity": 5, "unit": "beg"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.89, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "converted bulk quantities to product units"},
    ),
    (
        "Saya nak tambah stok minggu ini. Boleh hantar 3 karung beras dan 10 botol minyak?",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 3, "unit": "karung"}, {"product_name": "Minyak Masak 5L", "quantity": 10, "unit": "botol"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.96, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "Selamat petang saya nak order tepung gandum 5 beg dan gula pasir 10 beg",
        {"intent": "order", "items": [{"product_name": "Tepung Gandum 1kg", "quantity": 5, "unit": "beg"}, {"product_name": "Gula Pasir 1kg", "quantity": 10, "unit": "beg"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.97, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "Nak tanya pasal harga sardin dan mee segera untuk order dalam kuantiti besar",
        {"intent": "inquiry", "items": [{"product_name": "Sardin 425g", "quantity": 0, "unit": None}, {"product_name": "Mee Segera 30pcs", "quantity": 0, "unit": None}], "delivery_address": None, "language_detected": "malay", "confidence": 0.93, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "bulk pricing inquiry"},
    ),
    (
        "Pesanan tambahan: kicap manis 10 botol susu cair 5 kotak sardin 30 tin",
        {"intent": "order", "items": [{"product_name": "Kicap Manis 625ml", "quantity": 10, "unit": "botol"}, {"product_name": "Susu Cair 1L", "quantity": 5, "unit": "kotak"}, {"product_name": "Sardin 425g", "quantity": 30, "unit": "tin"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.97, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "add-on order"},
    ),

    # ── Price / stock inquiries (41-50) ────────────────────────────────────
    (
        "boss brape hrg beras skrg nk order byk skit",
        {"intent": "inquiry", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 0, "unit": None}], "delivery_address": None, "language_detected": "malay", "confidence": 0.91, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "price inquiry before placing bulk order"},
    ),
    (
        "ada stok minyak masak 5L tak brape?",
        {"intent": "inquiry", "items": [{"product_name": "Minyak Masak 5L", "quantity": 0, "unit": None}], "delivery_address": None, "language_detected": "malay", "confidence": 0.92, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "stock availability and price inquiry"},
    ),
    (
        "check stock sardin ada tak boss nk 50 tin",
        {"intent": "inquiry", "items": [{"product_name": "Sardin 425g", "quantity": 50, "unit": "tin"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.88, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "stock check with intended quantity"},
    ),
    (
        "brape harga mee segera sekotak nk order 10 kotak",
        {"intent": "inquiry", "items": [{"product_name": "Mee Segera 30pcs", "quantity": 10, "unit": "kotak"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.9, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "price inquiry with order intent"},
    ),
    (
        "stok gula ada nk order 100 beg",
        {"intent": "inquiry", "items": [{"product_name": "Gula Pasir 1kg", "quantity": 100, "unit": "beg"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.89, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "stock check for large order"},
    ),
    (
        "boss ada diskaun tak kalau order besar nk order minyak 100 botol",
        {"intent": "inquiry", "items": [{"product_name": "Minyak Masak 5L", "quantity": 100, "unit": "botol"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.87, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "bulk discount inquiry"},
    ),
    (
        "price susu cair brape sekarang last week lain ke?",
        {"intent": "inquiry", "items": [{"product_name": "Susu Cair 1L", "quantity": 0, "unit": None}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.9, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "price change inquiry"},
    ),
    (
        "ada promo tak untuk beras bulan ni?",
        {"intent": "inquiry", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 0, "unit": None}], "delivery_address": None, "language_detected": "malay", "confidence": 0.88, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "promotional pricing inquiry"},
    ),
    (
        "berapa kicap manis sebotol nak beli dalam kuantiti",
        {"intent": "inquiry", "items": [{"product_name": "Kicap Manis 625ml", "quantity": 0, "unit": None}], "delivery_address": None, "language_detected": "malay", "confidence": 0.91, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "bulk pricing inquiry"},
    ),
    (
        "boss tepung gandum ada restock tak da lama out of stock",
        {"intent": "inquiry", "items": [{"product_name": "Tepung Gandum 1kg", "quantity": 0, "unit": None}], "delivery_address": None, "language_detected": "malay", "confidence": 0.93, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "restock availability inquiry"},
    ),

    # ── Large multi-item orders (51-60) ────────────────────────────────────
    (
        "boss nk order beras 5 guni minyak 20 btl gula 30 beg tepung 10 beg sardin 50 tin",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 5, "unit": "karung"}, {"product_name": "Minyak Masak 5L", "quantity": 20, "unit": "botol"}, {"product_name": "Gula Pasir 1kg", "quantity": 30, "unit": "beg"}, {"product_name": "Tepung Gandum 1kg", "quantity": 10, "unit": "beg"}, {"product_name": "Sardin 425g", "quantity": 50, "unit": "tin"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.94, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "large monthly restock"},
    ),
    (
        "restok kedai mee 10 kotak susu 5 kotak kicap 20 btl beras 2 guni",
        {"intent": "order", "items": [{"product_name": "Mee Segera 30pcs", "quantity": 10, "unit": "kotak"}, {"product_name": "Susu Cair 1L", "quantity": 5, "unit": "kotak"}, {"product_name": "Kicap Manis 625ml", "quantity": 20, "unit": "botol"}, {"product_name": "Beras Tempatan 10kg", "quantity": 2, "unit": "karung"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.93, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "order bulanan minyak 50 btl beras 10 guni gula 100 beg sardin 200 tin",
        {"intent": "order", "items": [{"product_name": "Minyak Masak 5L", "quantity": 50, "unit": "botol"}, {"product_name": "Beras Tempatan 10kg", "quantity": 10, "unit": "karung"}, {"product_name": "Gula Pasir 1kg", "quantity": 100, "unit": "beg"}, {"product_name": "Sardin 425g", "quantity": 200, "unit": "tin"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.95, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "monthly bulk order"},
    ),
    (
        "nk order tepung 20 beg gula 20 beg minyak 10 btl susu 10 kotak",
        {"intent": "order", "items": [{"product_name": "Tepung Gandum 1kg", "quantity": 20, "unit": "beg"}, {"product_name": "Gula Pasir 1kg", "quantity": 20, "unit": "beg"}, {"product_name": "Minyak Masak 5L", "quantity": 10, "unit": "botol"}, {"product_name": "Susu Cair 1L", "quantity": 10, "unit": "kotak"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.95, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "stok restoran beras 5 karung minyak 30 btl kicap 10 btl sardin 100 tin",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 5, "unit": "karung"}, {"product_name": "Minyak Masak 5L", "quantity": 30, "unit": "botol"}, {"product_name": "Kicap Manis 625ml", "quantity": 10, "unit": "botol"}, {"product_name": "Sardin 425g", "quantity": 100, "unit": "tin"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.93, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "restaurant restock"},
    ),
    (
        "boss list order: 1) beras 3 guni 2) minyak 10 btl 3) gula 5 beg 4) mee 2 kotak",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 3, "unit": "karung"}, {"product_name": "Minyak Masak 5L", "quantity": 10, "unit": "botol"}, {"product_name": "Gula Pasir 1kg", "quantity": 5, "unit": "beg"}, {"product_name": "Mee Segera 30pcs", "quantity": 2, "unit": "kotak"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.97, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "numbered list format"},
    ),
    (
        "weekly order susu 30 kotak mee 20 kotak sardin 50 tin kicap 15 btl",
        {"intent": "order", "items": [{"product_name": "Susu Cair 1L", "quantity": 30, "unit": "kotak"}, {"product_name": "Mee Segera 30pcs", "quantity": 20, "unit": "kotak"}, {"product_name": "Sardin 425g", "quantity": 50, "unit": "tin"}, {"product_name": "Kicap Manis 625ml", "quantity": 15, "unit": "botol"}], "delivery_address": None, "language_detected": "mixed", "confidence": 0.95, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "recurring weekly order"},
    ),
    (
        "order 10 botol minyak 5 beg gula 3 tin sardin 2 beg tepung 1 kotak susu",
        {"intent": "order", "items": [{"product_name": "Minyak Masak 5L", "quantity": 10, "unit": "botol"}, {"product_name": "Gula Pasir 1kg", "quantity": 5, "unit": "beg"}, {"product_name": "Sardin 425g", "quantity": 3, "unit": "tin"}, {"product_name": "Tepung Gandum 1kg", "quantity": 2, "unit": "beg"}, {"product_name": "Susu Cair 1L", "quantity": 1, "unit": "kotak"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.96, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "restock semua beras 2 karung minyak 15 btl gula 20 beg tepung 10 beg",
        {"intent": "order", "items": [{"product_name": "Beras Tempatan 10kg", "quantity": 2, "unit": "karung"}, {"product_name": "Minyak Masak 5L", "quantity": 15, "unit": "botol"}, {"product_name": "Gula Pasir 1kg", "quantity": 20, "unit": "beg"}, {"product_name": "Tepung Gandum 1kg", "quantity": 10, "unit": "beg"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.94, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": None},
    ),
    (
        "boss nk order semua dry goods untuk bulan ni minyak 40 btl beras 8 guni gula 60 beg mee 15 kotak tepung 25 beg kicap 30 btl sardin 80 tin susu 20 kotak",
        {"intent": "order", "items": [{"product_name": "Minyak Masak 5L", "quantity": 40, "unit": "botol"}, {"product_name": "Beras Tempatan 10kg", "quantity": 8, "unit": "karung"}, {"product_name": "Gula Pasir 1kg", "quantity": 60, "unit": "beg"}, {"product_name": "Mee Segera 30pcs", "quantity": 15, "unit": "kotak"}, {"product_name": "Tepung Gandum 1kg", "quantity": 25, "unit": "beg"}, {"product_name": "Kicap Manis 625ml", "quantity": 30, "unit": "botol"}, {"product_name": "Sardin 425g", "quantity": 80, "unit": "tin"}, {"product_name": "Susu Cair 1L", "quantity": 20, "unit": "kotak"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.96, "clarification_needed": False, "clarification_message": None, "references_previous_order": False, "notes": "full monthly order covering all catalog items"},
    ),

    # ── Ambiguous / low confidence / clarification needed (61-70) ──────────
    (
        "boss nk benda tu",
        {"intent": "other", "items": [], "delivery_address": None, "language_detected": "malay", "confidence": 0.1, "clarification_needed": True, "clarification_message": "Maaf boss, boleh nyatakan produk dan kuantiti yang nak dipesan? / Sorry, could you specify which product and quantity you'd like to order?", "references_previous_order": False, "notes": "too vague to parse"},
    ),
    (
        "minyak ke gula ke sama je la",
        {"intent": "other", "items": [], "delivery_address": None, "language_detected": "malay", "confidence": 0.15, "clarification_needed": True, "clarification_message": "Boleh terangkan lagi sikit? Nak order minyak atau gula, dan berapa banyak? / Can you clarify — would you like to order oil or sugar, and how much?", "references_previous_order": False, "notes": "ambiguous product selection"},
    ),
    (
        "nk order bende biase la boss",
        {"intent": "order", "items": [], "delivery_address": None, "language_detected": "malay", "confidence": 0.25, "clarification_needed": True, "clarification_message": "Terima kasih! Boleh bagitau produk dan kuantiti yang nak dipesan? / Thanks! Could you list the products and quantities you'd like?", "references_previous_order": False, "notes": "references a usual order but no prior order found"},
    ),
    (
        "sama mcm minggu lepas tp lagi banyak",
        {"intent": "order", "items": [], "delivery_address": None, "language_detected": "malay", "confidence": 0.4, "clarification_needed": True, "clarification_message": "Boleh sahkan produk dan kuantiti baru? Saya akan semak pesanan minggu lepas. / Can you confirm the new quantities? I'll check last week's order.", "references_previous_order": True, "notes": "references previous order with quantity increase"},
    ),
    (
        "semua yang ada la boss",
        {"intent": "other", "items": [], "delivery_address": None, "language_detected": "malay", "confidence": 0.05, "clarification_needed": True, "clarification_message": "Maaf, boleh nyatakan produk spesifik dan kuantiti yang diperlukan? / Sorry, could you specify which products and quantities you need?", "references_previous_order": False, "notes": "cannot interpret 'everything available' as a structured order"},
    ),
    (
        "boss 5 beg tu cukup tak untuk sebulan?",
        {"intent": "inquiry", "items": [], "delivery_address": None, "language_detected": "malay", "confidence": 0.3, "clarification_needed": True, "clarification_message": "5 beg produk apa ya boss? / Which product are you referring to — 5 bags of what?", "references_previous_order": False, "notes": "product not specified"},
    ),
    (
        "nk order tp tak sure brape mungkin 10 ke 20 beg gula",
        {"intent": "order", "items": [{"product_name": "Gula Pasir 1kg", "quantity": 10, "unit": "beg"}], "delivery_address": None, "language_detected": "malay", "confidence": 0.55, "clarification_needed": True, "clarification_message": "Nak order 10 beg atau 20 beg gula pasir? / Would you like to order 10 or 20 bags of sugar?", "references_previous_order": False, "notes": "quantity uncertain; defaulting to lower bound"},
    ),
    (
        "adik sy kata order minyak tp sy tak sure berapa liter",
        {"intent": "order", "items": [{"product_name": "Minyak Masak 5L", "quantity": 0, "unit": None}], "delivery_address": None, "language_detected": "malay", "confidence": 0.45, "clarification_needed": True, "clarification_message": "Berapa botol minyak masak nak dipesan? / How many bottles of cooking oil would you like to order?", "references_previous_order": False, "notes": "product known but quantity unclear"},
    ),
    (
        "bos tolong suggest la ape nk order minggu ni",
        {"intent": "inquiry", "items": [], "delivery_address": None, "language_detected": "malay", "confidence": 0.2, "clarification_needed": True, "clarification_message": "Saya tidak boleh buat cadangan pembelian secara langsung. Boleh semak stok semasa dan beritahu apa yang perlu ditambah? / I can't make purchase suggestions directly — please check your current stock and let me know what needs replenishing.", "references_previous_order": False, "notes": "open-ended suggestion request, not an order"},
    ),
    (
        "nk order sikit je untuk test dulu",
        {"intent": "order", "items": [], "delivery_address": None, "language_detected": "malay", "confidence": 0.35, "clarification_needed": True, "clarification_message": "Boleh nyatakan produk dan kuantiti untuk pesanan percubaan ini? / Could you specify the product and quantity for this trial order?", "references_previous_order": False, "notes": "intent clear but no product or quantity specified"},
    ),

    # ── Complaints (71-75) ─────────────────────────────────────────────────
    (
        "boss order haritu salah hantar dapat beras tp nk minyak",
        {"intent": "complaint", "items": [{"product_name": "Minyak Masak 5L", "quantity": 0, "unit": None}], "delivery_address": None, "language_detected": "malay", "confidence": 0.9, "clarification_needed": False, "clarification_message": None, "references_previous_order": True, "notes": "wrong item delivered — received rice instead of oil"},
    ),
    (
        "minyak yang hantar semalam ada yang bocor boss",
        {"intent": "complaint", "items": [{"product_name": "Minyak Masak 5L", "quantity": 0, "unit": None}], "delivery_address": None, "language_detected": "malay", "confidence": 0.92, "clarification_needed": False, "clarification_message": None, "references_previous_order": True, "notes": "damaged goods — leaking oil bottles from yesterday's delivery"},
    ),
    (
        "boss kenapa lambat sangat hantar da 3 hari tunggu",
        {"intent": "complaint", "items": [], "delivery_address": None, "language_detected": "malay", "confidence": 0.88, "clarification_needed": False, "clarification_message": None, "references_previous_order": True, "notes": "late delivery complaint — 3 days waiting"},
    ),
    (
        "sardin yang dapat kali ni lain brand bukan yang biasa",
        {"intent": "complaint", "items": [{"product_name": "Sardin 425g", "quantity": 0, "unit": None}], "delivery_address": None, "language_detected": "malay", "confidence": 0.89, "clarification_needed": False, "clarification_message": None, "references_previous_order": True, "notes": "wrong brand delivered for sardines"},
    ),
    (
        "boss quantity tak cukup order 10 dapat 8 je",
        {"intent": "complaint", "items": [], "delivery_address": None, "language_detected": "malay", "confidence": 0.91, "clarification_needed": False, "clarification_message": None, "references_previous_order": True, "notes": "short delivery — ordered 10 units, received 8"},
    ),

    # ── Repeat order references (76-80) ────────────────────────────────────
    (
        "boss same la mcm order minggu lepas",
        {"intent": "order", "items": [], "delivery_address": None, "language_detected": "malay", "confidence": 0.7, "clarification_needed": False, "clarification_message": None, "references_previous_order": True, "notes": "explicit repeat of last week's order"},
    ),
    (
        "nk repeat order yang dua minggu lepas tu",
        {"intent": "order", "items": [], "delivery_address": None, "language_detected": "malay", "confidence": 0.72, "clarification_needed": False, "clarification_message": None, "references_previous_order": True, "notes": "repeat of order from two weeks ago"},
    ),
    (
        "order lagi benda sama mcm last month tq",
        {"intent": "order", "items": [], "delivery_address": None, "language_detected": "mixed", "confidence": 0.68, "clarification_needed": False, "clarification_message": None, "references_previous_order": True, "notes": "repeat of last month's order"},
    ),
    (
        "boss topup la stok mcm biasa",
        {"intent": "order", "items": [], "delivery_address": None, "language_detected": "malay", "confidence": 0.65, "clarification_needed": False, "clarification_message": None, "references_previous_order": True, "notes": "routine restock referencing usual order pattern"},
    ),
    (
        "same order la tambah 20% dari last time",
        {"intent": "order", "items": [], "delivery_address": None, "language_detected": "mixed", "confidence": 0.6, "clarification_needed": True, "clarification_message": "Saya akan semak pesanan lepas dan tambah 20%. Boleh sahkan produk yang nak ditambah? / I'll check your last order and add 20%. Can you confirm which items to scale up?", "references_previous_order": True, "notes": "repeat with quantity increase — needs confirmation"},
    ),
]


def seed(supabase_url: str, supabase_key: str) -> None:
    import httpx
    from supabase import create_client
    from app.services.embedding_service import embed_batch

    print(f"Connecting to Supabase at {supabase_url}...")
    client = create_client(supabase_url, supabase_key)
    # Use HTTP/1.1 to avoid PostgREST GOAWAY issue
    old = client.postgrest.session
    client.postgrest.session = httpx.Client(
        base_url=str(old.base_url),
        headers=dict(old.headers),
        http2=False,
    )
    old.close()

    messages = [msg for msg, _ in EXAMPLES]
    outputs = [out for _, out in EXAMPLES]

    print(f"Embedding {len(messages)} examples with paraphrase-multilingual-MiniLM-L12-v2...")
    embeddings = embed_batch(messages)

    rows = [
        {
            "raw_message": msg,
            "parsed_output": json.dumps(out, ensure_ascii=False),
            "embedding": emb,
        }
        for msg, out, emb in zip(messages, outputs, embeddings)
    ]

    print("Upserting rows into few_shot_examples...")
    # Upsert on raw_message unique constraint — safe to re-run
    client.table("few_shot_examples").upsert(rows, on_conflict="raw_message").execute()
    print(f"Done — {len(rows)} examples seeded.")


if __name__ == "__main__":
    url = os.environ.get("SUPABASE_URL") or os.environ.get("supabase_url")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("supabase_service_key")
    if not url or not key:
        print("ERROR: Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.")
        sys.exit(1)
    seed(url, key)
