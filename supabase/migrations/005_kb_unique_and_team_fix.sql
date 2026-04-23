-- ─────────────────────────────────────────
-- 005: Add unique constraint to knowledge_base for upsert
--     (required by onConflict: "merchant_id,document_type")
-- ─────────────────────────────────────────

alter table knowledge_base
  add constraint kb_merchant_type_unique unique (merchant_id, document_type);
