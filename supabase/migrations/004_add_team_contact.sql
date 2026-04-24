-- ─────────────────────────────────────────
-- 004: Add contact_number to merchant_users
-- ─────────────────────────────────────────

alter table merchant_users
  add column if not exists contact_number text;
