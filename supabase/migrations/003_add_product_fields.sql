-- ─────────────────────────────────────────
-- 003: Add UI fields to product table
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────

alter table product
  add column if not exists unit text,
  add column if not exists reorder_threshold integer default 0;