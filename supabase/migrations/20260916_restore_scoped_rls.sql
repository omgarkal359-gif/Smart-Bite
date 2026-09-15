-- Migration: 20260916_restore_scoped_rls.sql
-- SECURITY FIX. Supersedes the over-permissive policies created in
-- 20260911_fix_orders_sync_and_rls.sql, which opened orders, order_items,
-- order_status_history, receipts and stalls to anon/authenticated with
-- USING (true) / WITH CHECK (true) — allowing any client (anon key) to read,
-- modify and DELETE every row in those tables (IDOR).
--
-- This restores ownership-scoped policies using the existing helpers
-- public.is_admin() and public.owns_stall(text). Realtime replication is
-- preserved (rows are still streamed, now filtered per-viewer by RLS).
--
-- NOTE: not auto-applied. Review, then run in the Supabase SQL Editor after
-- confirming students log in (authenticated) and vendors are provisioned as
-- real auth users with accounts.role='vendor' + accounts.shop_id set.

BEGIN;

-- Ensure RLS stays enabled
ALTER TABLE IF EXISTS public.orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.receipts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stalls               ENABLE ROW LEVEL SECURITY;

-- ── Drop the permissive policies ────────────────────────────────────────────
DROP POLICY IF EXISTS p_orders_read   ON public.orders;
DROP POLICY IF EXISTS p_orders_insert ON public.orders;
DROP POLICY IF EXISTS p_orders_update ON public.orders;
DROP POLICY IF EXISTS p_orders_delete ON public.orders;

DROP POLICY IF EXISTS p_items_read   ON public.order_items;
DROP POLICY IF EXISTS p_items_insert ON public.order_items;
DROP POLICY IF EXISTS p_items_update ON public.order_items;
DROP POLICY IF EXISTS p_items_delete ON public.order_items;

DROP POLICY IF EXISTS p_hist_read   ON public.order_status_history;
DROP POLICY IF EXISTS p_hist_insert ON public.order_status_history;

DROP POLICY IF EXISTS p_receipts_read   ON public.receipts;
DROP POLICY IF EXISTS p_receipts_insert ON public.receipts;
DROP POLICY IF EXISTS p_receipts_update ON public.receipts;

DROP POLICY IF EXISTS p_stalls_read   ON public.stalls;
DROP POLICY IF EXISTS p_stalls_insert ON public.stalls;
DROP POLICY IF EXISTS p_stalls_update ON public.stalls;
DROP POLICY IF EXISTS p_stalls_delete ON public.stalls;

-- ── ORDERS ──────────────────────────────────────────────────────────────────
-- Read: admin, the customer (by id or email), or the stall owner.
CREATE POLICY p_orders_read ON public.orders FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR customer_id = auth.uid()
    OR customer_email = LOWER(auth.jwt() ->> 'email')
    OR public.owns_stall(stall_id)
  );
-- Insert: a customer may only create their own order.
CREATE POLICY p_orders_insert ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR customer_id = auth.uid()
    OR customer_email = LOWER(auth.jwt() ->> 'email')
  );
-- Update: stall owner (status changes) or admin.
CREATE POLICY p_orders_update ON public.orders FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.owns_stall(stall_id))
  WITH CHECK (public.is_admin() OR public.owns_stall(stall_id));
-- Delete: admin only.
CREATE POLICY p_orders_delete ON public.orders FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── ORDER_ITEMS (scoped through the parent order) ───────────────────────────
CREATE POLICY p_items_read ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND (
      public.is_admin()
      OR o.customer_id = auth.uid()
      OR o.customer_email = LOWER(auth.jwt() ->> 'email')
      OR public.owns_stall(o.stall_id)
    )
  ));
CREATE POLICY p_items_insert ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND (
      public.is_admin()
      OR o.customer_id = auth.uid()
      OR o.customer_email = LOWER(auth.jwt() ->> 'email')
    )
  ));
CREATE POLICY p_items_update ON public.order_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.is_admin() OR public.owns_stall(o.stall_id))
  ));
CREATE POLICY p_items_delete ON public.order_items FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── ORDER_STATUS_HISTORY ────────────────────────────────────────────────────
CREATE POLICY p_hist_read ON public.order_status_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND (
      public.is_admin()
      OR o.customer_id = auth.uid()
      OR o.customer_email = LOWER(auth.jwt() ->> 'email')
      OR public.owns_stall(o.stall_id)
    )
  ));
-- Insert: stall owner (status change) or admin.
CREATE POLICY p_hist_insert ON public.order_status_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_id AND (public.is_admin() OR public.owns_stall(o.stall_id))
  ));

-- ── RECEIPTS ────────────────────────────────────────────────────────────────
CREATE POLICY p_receipts_read ON public.receipts FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR customer_email = LOWER(auth.jwt() ->> 'email')
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND public.owns_stall(o.stall_id))
  );
CREATE POLICY p_receipts_insert ON public.receipts FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR customer_email = LOWER(auth.jwt() ->> 'email')
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (
      o.customer_id = auth.uid() OR o.customer_email = LOWER(auth.jwt() ->> 'email')
    ))
  );
CREATE POLICY p_receipts_update ON public.receipts FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── STALLS ──────────────────────────────────────────────────────────────────
-- Public read (menu browsing). Writes limited to the owning vendor or admin;
-- deletes admin-only.
CREATE POLICY p_stalls_read ON public.stalls FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY p_stalls_insert ON public.stalls FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.owns_stall(id));
CREATE POLICY p_stalls_update ON public.stalls FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.owns_stall(id))
  WITH CHECK (public.is_admin() OR public.owns_stall(id));
CREATE POLICY p_stalls_delete ON public.stalls FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── Table-level privileges ──────────────────────────────────────────────────
-- Undo the "GRANT ALL ... TO anon" from the previous migration. anon may only
-- read stalls; everything else requires an authenticated session (RLS then
-- filters rows). service_role bypasses RLS and keeps full access.
REVOKE ALL ON TABLE public.orders               FROM anon;
REVOKE ALL ON TABLE public.order_items          FROM anon;
REVOKE ALL ON TABLE public.order_status_history FROM anon;
REVOKE ALL ON TABLE public.receipts             FROM anon;
REVOKE ALL ON TABLE public.stalls               FROM anon;

GRANT SELECT                         ON TABLE public.stalls               TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_items          TO authenticated;
GRANT SELECT, INSERT                 ON TABLE public.order_status_history  TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON TABLE public.receipts             TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stalls               TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.order_items_id_seq          TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.order_status_history_id_seq TO authenticated;

COMMIT;
