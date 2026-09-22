-- =============================================================================
-- Orders SELECT scoping + masked public queue RPC
-- -----------------------------------------------------------------------------
-- Previously p_orders_read / p_items_read were USING (true) to anon+authenticated,
-- so ANY visitor could read every order row incl. customer name/email/phone (PII)
-- — a broad IDOR. This locks reads to the owning customer, the owning vendor, or
-- an admin, and moves the public pickup board onto a SECURITY DEFINER RPC that
-- returns only masked, non-PII columns.
--
-- Run in the Supabase SQL Editor AFTER 20260922180000_orders_rls_ownership.sql.
-- Idempotent.
-- =============================================================================

-- ── Masked public queue (drives /board for everyone, incl. anon) ─────────────
CREATE OR REPLACE FUNCTION public.get_public_order_queue()
RETURNS TABLE (
  id text,
  order_number text,
  stall_id text,
  stall_name text,
  status text,
  created_at timestamptz,
  masked_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.order_number,
    o.stall_id,
    o.stall_name,
    o.status,
    o.created_at,
    CASE
      WHEN o.customer_name IS NULL OR btrim(o.customer_name) = '' THEN 'Guest'
      ELSE split_part(o.customer_name, ' ', 1)
           || CASE WHEN btrim(coalesce(split_part(o.customer_name, ' ', 2), '')) <> ''
                   THEN ' ' || left(split_part(o.customer_name, ' ', 2), 1) || '.'
                   ELSE '' END
    END AS masked_name
  FROM public.orders o
  WHERE o.status IN ('placed', 'pending_cash', 'preparing', 'ready')
  ORDER BY o.created_at DESC
  LIMIT 200;
$$;

REVOKE ALL ON FUNCTION public.get_public_order_queue() FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_order_queue() TO anon, authenticated;

-- ── Lock direct reads to owner / vendor / admin ──────────────────────────────
DROP POLICY IF EXISTS p_orders_read ON public.orders;
CREATE POLICY p_orders_read ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.owns_stall(stall_id)
    OR customer_id = auth.uid()
    OR customer_email = lower(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS p_items_read ON public.order_items;
CREATE POLICY p_items_read ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (
          public.is_admin()
          OR public.owns_stall(o.stall_id)
          OR o.customer_id = auth.uid()
          OR o.customer_email = lower(auth.jwt() ->> 'email')
        )
    )
  );
