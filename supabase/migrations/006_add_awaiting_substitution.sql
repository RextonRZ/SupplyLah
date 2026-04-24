-- ─────────────────────────────────────────
-- 006: Add "Awaiting Substitution" to order status
-- ─────────────────────────────────────────

ALTER TABLE "order" DROP CONSTRAINT IF EXISTS order_order_status_check;
ALTER TABLE "order" ADD CONSTRAINT order_order_status_check
  CHECK (order_status IN (
    'Pending', 'Awaiting Substitution', 'Awaiting Confirmation',
    'Confirmed', 'Dispatched', 'Failed', 'Expired'
  ));
