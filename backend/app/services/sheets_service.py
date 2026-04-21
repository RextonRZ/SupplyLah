"""Google Sheets inventory sync — read/write with mock fallback."""
from __future__ import annotations

import logging

from app.config import get_settings

logger = logging.getLogger(__name__)


async def sync_inventory_from_sheets(merchant_id: str) -> list[dict]:
    """Pull current inventory from Google Sheets and return rows.

    Expected sheet schema: product_sku | product_name | unit | unit_price | available_quantity | reorder_threshold
    """
    settings = get_settings()

    if settings.use_mock_sheets or not settings.google_sheets_id:
        logger.info("[MOCK Sheets] Returning empty sync — inventory managed via Supabase directly")
        return []

    try:
        import gspread  # type: ignore
        from google.oauth2.service_account import Credentials  # type: ignore

        scopes = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive",
        ]
        creds = Credentials.from_service_account_file(settings.google_credentials_path, scopes=scopes)
        gc = gspread.authorize(creds)
        ws = gc.open_by_key(settings.google_sheets_id).sheet1
        records = ws.get_all_records()
        logger.info("Sheets sync: pulled %d product rows", len(records))
        return records
    except Exception as exc:
        logger.error("Google Sheets sync failed: %s", exc)
        return []


async def write_stock_deduction_to_sheets(sku: str, new_qty: int) -> bool:
    """Write back updated stock quantity to Google Sheets after order confirmation."""
    settings = get_settings()

    if settings.use_mock_sheets:
        logger.info("[MOCK Sheets] Would update SKU %s → qty %d", sku, new_qty)
        return True

    try:
        import gspread  # type: ignore
        from google.oauth2.service_account import Credentials  # type: ignore

        scopes = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
        creds = Credentials.from_service_account_file(settings.google_credentials_path, scopes=scopes)
        gc = gspread.authorize(creds)
        ws = gc.open_by_key(settings.google_sheets_id).sheet1
        cell = ws.find(sku)
        if cell:
            # Assumes available_quantity is column 5
            ws.update_cell(cell.row, 5, new_qty)
        return True
    except Exception as exc:
        logger.error("Sheets write-back failed: %s", exc)
        return False
