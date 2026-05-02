-- Add Awaiting Payment order status and payment tracking columns.

-- Drop and recreate the status check constraint to include the new state.
ALTER TABLE "order" DROP CONSTRAINT IF EXISTS order_order_status_check;
ALTER TABLE "order" ADD CONSTRAINT order_order_status_check
  CHECK (order_status IN (
    'Pending',
    'Awaiting Substitution',
    'Awaiting Confirmation',
    'Awaiting Payment',
    'Confirmed',
    'Dispatched',
    'Failed',
    'Expired'
  ));

-- Payment details captured when buyer sends proof.
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS payment_method   text;
