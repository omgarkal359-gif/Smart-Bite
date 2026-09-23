-- =============================================================================
-- Migration: platform fees (commission + convenience) and vendor settlements
--
-- Adds:
--   1. platform_config       — global commission + convenience-fee settings.
--   2. vendors               — per-vendor convenience-fee override (nullable).
--   3. menu_items            — per-item convenience-fee override (nullable).
--   4. orders                — snapshot of convenience_fee + commission_amount
--                              charged at order time (so historical settlement is
--                              accurate even if rates change later).
--   5. vendor_payouts        — the settlement ledger: one row per payout made to
--                              a stall. Admin-written, vendor-readable.
--
-- Money model (single-stall order):
--   customer pays   = subtotal + convenience_fee
--   platform keeps  = convenience_fee + commission_amount
--   vendor earns    = subtotal - commission_amount
--   commission_amount = subtotal * commission_percent/100 + commission_flat
--     (depending on commission_type: 'percent' | 'flat' | 'both')
--
-- Idempotent: safe to re-run.
-- =============================================================================

-- 1. Global config (single-row platform_config) ------------------------------
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS commission_type          TEXT    NOT NULL DEFAULT 'percent',  -- percent | flat | both
  ADD COLUMN IF NOT EXISTS commission_percent        NUMERIC NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS commission_flat           NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS convenience_fee_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS convenience_fee           NUMERIC NOT NULL DEFAULT 0;

-- 2. Per-vendor convenience-fee override (NULL = inherit global) --------------
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS convenience_fee_enabled   BOOLEAN,   -- NULL inherit / TRUE force on / FALSE force off
  ADD COLUMN IF NOT EXISTS convenience_fee           NUMERIC;

-- 3. Per-item convenience-fee override (NULL = inherit) ----------------------
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS convenience_fee_enabled   BOOLEAN,
  ADD COLUMN IF NOT EXISTS convenience_fee           NUMERIC;

-- 4. Per-order snapshots ------------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS convenience_fee           NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_amount         NUMERIC NOT NULL DEFAULT 0;

-- 5. Settlement ledger --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vendor_payouts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stall_id    TEXT NOT NULL,
  amount      NUMERIC NOT NULL CHECK (amount > 0),   -- what was actually paid to the vendor
  gross       NUMERIC NOT NULL DEFAULT 0,            -- snapshot: vendor gross (subtotal) covered by this payout
  commission  NUMERIC NOT NULL DEFAULT 0,            -- snapshot: commission deducted for the covered window
  period_from DATE,
  period_to   DATE,
  method      TEXT NOT NULL DEFAULT 'manual',        -- manual | cashfree
  reference   TEXT,                                  -- UTR / txn id / note
  status      TEXT NOT NULL DEFAULT 'paid',          -- paid | pending
  notes       TEXT,
  created_by  TEXT,                                  -- admin email who recorded it
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_payouts_stall   ON public.vendor_payouts (stall_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payouts_created ON public.vendor_payouts (created_at DESC);

ALTER TABLE public.vendor_payouts ENABLE ROW LEVEL SECURITY;

-- Admins: full control. Vendors: read only their own stall's payout history.
DROP POLICY IF EXISTS p_vendor_payouts_admin_all  ON public.vendor_payouts;
DROP POLICY IF EXISTS p_vendor_payouts_vendor_read ON public.vendor_payouts;

CREATE POLICY p_vendor_payouts_admin_all ON public.vendor_payouts
  FOR ALL  USING (public.is_admin())        WITH CHECK (public.is_admin());

CREATE POLICY p_vendor_payouts_vendor_read ON public.vendor_payouts
  FOR SELECT USING (public.owns_stall(stall_id));
