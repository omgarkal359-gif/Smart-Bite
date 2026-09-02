-- =============================================================================
-- Migration: 001_enable_rls_policies.sql
-- Description: Authoritative Row Level Security (RLS) policies for Supabase Postgres
-- =============================================================================

-- 1. Enable RLS on all public schema tables
ALTER TABLE IF EXISTS stalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payment_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- STALLS TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read access for stalls" ON stalls;
CREATE POLICY "Public read access for stalls"
  ON stalls FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Vendor and Admin update access for stalls" ON stalls;
CREATE POLICY "Vendor and Admin update access for stalls"
  ON stalls FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin' OR 
    ((auth.jwt() ->> 'role') = 'owner' AND (auth.jwt() ->> 'shopId') = id)
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'admin' OR 
    ((auth.jwt() ->> 'role') = 'owner' AND (auth.jwt() ->> 'shopId') = id)
  );

-- -----------------------------------------------------------------------------
-- MENU_ITEMS TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read access for menu items" ON menu_items;
CREATE POLICY "Public read access for menu items"
  ON menu_items FOR SELECT
  TO public
  USING (available = 1 OR (auth.jwt() ->> 'role') IN ('admin', 'owner'));

DROP POLICY IF EXISTS "Vendor and Admin insert access for menu items" ON menu_items;
CREATE POLICY "Vendor and Admin insert access for menu items"
  ON menu_items FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'admin' OR 
    ((auth.jwt() ->> 'role') = 'owner' AND (auth.jwt() ->> 'shopId') = stallId)
  );

DROP POLICY IF EXISTS "Vendor and Admin update access for menu items" ON menu_items;
CREATE POLICY "Vendor and Admin update access for menu items"
  ON menu_items FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin' OR 
    ((auth.jwt() ->> 'role') = 'owner' AND (auth.jwt() ->> 'shopId') = stallId)
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'admin' OR 
    ((auth.jwt() ->> 'role') = 'owner' AND (auth.jwt() ->> 'shopId') = stallId)
  );

-- -----------------------------------------------------------------------------
-- ORDERS TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Student and Vendor read access for orders" ON orders;
CREATE POLICY "Student and Vendor read access for orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin' OR
    (select auth.uid())::text = customerId OR
    (auth.jwt() ->> 'email') = customerId OR
    (auth.jwt() ->> 'role') = 'owner'
  );

DROP POLICY IF EXISTS "Authenticated student insert access for orders" ON orders;
CREATE POLICY "Authenticated student insert access for orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'role') = 'admin' OR
    (select auth.uid())::text = customerId OR
    (auth.jwt() ->> 'email') = customerId
  );

DROP POLICY IF EXISTS "Vendor and Admin update access for orders" ON orders;
CREATE POLICY "Vendor and Admin update access for orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') IN ('admin', 'owner')
  )
  WITH CHECK (
    (auth.jwt() ->> 'role') IN ('admin', 'owner')
  );

-- -----------------------------------------------------------------------------
-- ORDER_ITEMS TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read access for order items" ON order_items;
CREATE POLICY "Authenticated read access for order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated insert access for order items" ON order_items;
CREATE POLICY "Authenticated insert access for order items"
  ON order_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- USERS TABLE POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own record or admin" ON users;
CREATE POLICY "Users can read own record or admin"
  ON users FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin' OR
    (select auth.uid())::text = id::text OR
    (auth.jwt() ->> 'email') = username
  );

-- -----------------------------------------------------------------------------
-- SETTLEMENTS AND PAYMENT EVENTS (Service Role Only)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin and Service Role access for settlements" ON order_settlements;
CREATE POLICY "Admin and Service Role access for settlements"
  ON order_settlements FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admin and Service Role access for payment events" ON payment_events;
CREATE POLICY "Admin and Service Role access for payment events"
  ON payment_events FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- -----------------------------------------------------------------------------
-- SENSITIVE COLUMNS PROTECTION (EXCLUDE PASSWORD FROM DATA API)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.profiles
WITH (security_invoker = true) AS
SELECT 
  id,
  username,
  name,
  role,
  shopId
FROM public.users;

GRANT SELECT ON public.profiles TO authenticated, anon;

-- -----------------------------------------------------------------------------
-- SECURITY DEFINER RPC PROTECTION
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable') THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
  END IF;
END $$;


