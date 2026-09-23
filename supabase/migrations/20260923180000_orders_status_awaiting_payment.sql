-- =============================================================================
-- Migration: allow 'awaiting_payment' and 'payment_failed' order statuses
--
-- Online orders are created as 'awaiting_payment' (hidden from the vendor) and
-- become 'placed' only when the payment webhook confirms success, or
-- 'payment_failed' on failure. The existing orders_status_check constraint did
-- not permit these values, so inserts failed. Extend the allowed set.
--
-- Idempotent.
-- =============================================================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY[
    'awaiting_payment'::text,
    'payment_failed'::text,
    'placed'::text,
    'pending_cash'::text,
    'preparing'::text,
    'ready'::text,
    'completed'::text,
    'cancelled'::text
  ]));
