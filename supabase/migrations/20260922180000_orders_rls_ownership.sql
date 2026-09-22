-- =============================================================================
-- Orders RLS ownership hardening
-- -----------------------------------------------------------------------------
-- The prior orders policies were fully permissive:
--   INSERT/UPDATE/DELETE ... WITH CHECK (true) / USING (true)
-- which let any caller create or alter an order on behalf of ANY user
-- (identity-spoofing) directly against PostgREST, bypassing the app layer.
--
-- This migration enforces ownership at the database layer so the client can no
-- longer forge customer_id. The app layer (src/api.js createOrder) already
-- derives customer_id from the Supabase session and computes the subtotal from
-- menu_items.price; these policies make that non-bypassable.
--
-- Run in the Supabase SQL Editor. Safe/idempotent (DROP ... IF EXISTS).
--
-- NOTE (still open, tracked separately): p_orders_read is intentionally left
-- permissive here because the public pickup board (/board) and the vendor
-- dashboard read orders. Locking SELECT to owner/vendor/admin will break the
-- board until getOrderQueue is reworked into a SECURITY DEFINER RPC that
-- returns only masked, non-PII columns. Do that before tightening SELECT.
-- =============================================================================

-- INSERT: a signed-in user may only create an order as themselves.
DROP POLICY IF EXISTS p_orders_insert ON public.orders;
CREATE POLICY p_orders_insert ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

-- UPDATE: the owning customer (e.g. cancel / pay), the owning vendor (status),
-- or an admin. No cross-user writes.
DROP POLICY IF EXISTS p_orders_update ON public.orders;
CREATE POLICY p_orders_update ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.owns_stall(stall_id) OR customer_id = auth.uid())
  WITH CHECK (public.is_admin() OR public.owns_stall(stall_id) OR customer_id = auth.uid());

-- DELETE: admin only (admin "reset orders" tooling).
DROP POLICY IF EXISTS p_orders_delete ON public.orders;
CREATE POLICY p_orders_delete ON public.orders
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- order_items follows the parent order's ownership on write. The prior
-- policies (p_items_insert/update/delete WITH CHECK (true), open to anon) are
-- replaced in place so the permissive versions can't OR back in.
DROP POLICY IF EXISTS p_items_insert ON public.order_items;
CREATE POLICY p_items_insert ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.customer_id = auth.uid() OR public.is_admin() OR public.owns_stall(o.stall_id))
    )
  );

DROP POLICY IF EXISTS p_items_update ON public.order_items;
CREATE POLICY p_items_update ON public.order_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (public.is_admin() OR public.owns_stall(o.stall_id) OR o.customer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS p_items_delete ON public.order_items;
CREATE POLICY p_items_delete ON public.order_items
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- p_items_read is left permissive (board/vendor read item lines); see the
-- SELECT note above for orders.
