-- Migration: 20260911_fix_orders_sync_and_rls.sql
-- Fix RLS policies and Realtime replication for orders, order_items, order_status_history, receipts, and stalls.

BEGIN;

-- Ensure RLS is enabled on order tables
ALTER TABLE IF EXISTS public.orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.receipts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stalls              ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive order policies if present
DROP POLICY IF EXISTS p_orders_read ON public.orders;
DROP POLICY IF EXISTS p_orders_insert ON public.orders;
DROP POLICY IF EXISTS p_orders_update ON public.orders;
DROP POLICY IF EXISTS p_orders_delete ON public.orders;

DROP POLICY IF EXISTS p_items_read ON public.order_items;
DROP POLICY IF EXISTS p_items_insert ON public.order_items;
DROP POLICY IF EXISTS p_items_update ON public.order_items;
DROP POLICY IF EXISTS p_items_delete ON public.order_items;

DROP POLICY IF EXISTS p_hist_read ON public.order_status_history;
DROP POLICY IF EXISTS p_hist_insert ON public.order_status_history;

DROP POLICY IF EXISTS p_receipts_read ON public.receipts;
DROP POLICY IF EXISTS p_receipts_insert ON public.receipts;
DROP POLICY IF EXISTS p_receipts_update ON public.receipts;

-- Create inclusive RLS policies for anon and authenticated users
CREATE POLICY p_orders_read ON public.orders FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_orders_insert ON public.orders FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY p_orders_update ON public.orders FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY p_orders_delete ON public.orders FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY p_items_read ON public.order_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_items_insert ON public.order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY p_items_update ON public.order_items FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY p_items_delete ON public.order_items FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY p_hist_read ON public.order_status_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_hist_insert ON public.order_status_history FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY p_receipts_read ON public.receipts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_receipts_insert ON public.receipts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY p_receipts_update ON public.receipts FOR UPDATE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS p_stalls_read ON public.stalls;
DROP POLICY IF EXISTS p_stalls_insert ON public.stalls;
DROP POLICY IF EXISTS p_stalls_update ON public.stalls;
DROP POLICY IF EXISTS p_stalls_delete ON public.stalls;

CREATE POLICY p_stalls_read ON public.stalls FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_stalls_insert ON public.stalls FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY p_stalls_update ON public.stalls FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY p_stalls_delete ON public.stalls FOR DELETE TO anon, authenticated USING (true);

GRANT ALL ON TABLE public.stalls TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.orders TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.order_items TO anon, authenticated, service_role;

-- Ensure publication for Supabase Realtime includes order tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stalls; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.receipts; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

COMMIT;
