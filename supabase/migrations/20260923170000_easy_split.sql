-- =============================================================================
-- Migration: Cashfree Easy Split (auto-split at payment)
--
-- When split is enabled and the order's stall has a Cashfree vendor_id, the PG
-- order is created with order_splits so Cashfree settles the vendor's share
-- (subtotal - commission) directly to the vendor's linked account, and keeps the
-- remainder (commission + convenience fee) with the platform merchant.
--
-- Adds:
--   platform_config.split_enabled  — global master switch for auto-split.
--   orders.settled_via             — 'cashfree_split' when auto-split was applied
--                                    (vendor auto-paid by Cashfree), else NULL
--                                    (collect-then-payout via the ledger).
--   orders.vendor_split_amount     — snapshot of the amount routed to the vendor.
--
-- Idempotent.
-- =============================================================================

ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS split_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS settled_via         TEXT,
  ADD COLUMN IF NOT EXISTS vendor_split_amount NUMERIC NOT NULL DEFAULT 0;

-- vendors.cashfree_vendor_id already exists (created earlier). Ensure present.
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS cashfree_vendor_id TEXT;
