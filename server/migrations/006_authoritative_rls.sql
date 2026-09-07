-- =============================================================================
-- Migration: 006_authoritative_rls.sql
-- Description: Authoritative Row Level Security (RLS) policies for all tables
-- Enforces least privilege, tenant isolation, and administrative overrides
-- =============================================================================

-- Enable RLS across all tables
ALTER TABLE IF EXISTS menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_settings ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- MENU_CATEGORIES POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read access for menu categories" ON menu_categories;
CREATE POLICY "Public read access for menu categories"
  ON menu_categories FOR SELECT
  TO public
  USING (is_active = true OR (auth.jwt() ->> 'role') IN ('admin', 'owner'));

DROP POLICY IF EXISTS "Vendor and Admin manage access for menu categories" ON menu_categories;
CREATE POLICY "Vendor and Admin manage access for menu categories"
  ON menu_categories FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') = 'admin' OR 
    ((auth.jwt() ->> 'role') = 'owner' AND (auth.jwt() ->> 'shopId') = stall_id)
  );

-- -----------------------------------------------------------------------------
-- ORDER_STATUS_HISTORY POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated read order status history" ON order_status_history;
CREATE POLICY "Authenticated read order status history"
  ON order_status_history FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'role') IN ('admin', 'owner') OR
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_status_history.order_id 
        AND (orders.customer_id = (select auth.uid())::text OR orders.customer_id = (auth.jwt() ->> 'email'))
    )
  );

-- -----------------------------------------------------------------------------
-- AUDIT_LOGS POLICIES (ADMIN READ ONLY, APPEND-ONLY)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin read audit logs" ON audit_logs;
CREATE POLICY "Admin read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Service role insert audit logs" ON audit_logs;
CREATE POLICY "Service role insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())::text OR 
    user_id = (auth.jwt() ->> 'email') OR
    (auth.jwt() ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid())::text OR user_id = (auth.jwt() ->> 'email'))
  WITH CHECK (user_id = (select auth.uid())::text OR user_id = (auth.jwt() ->> 'email'));

-- -----------------------------------------------------------------------------
-- SYSTEM_SETTINGS POLICIES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read system settings" ON system_settings;
CREATE POLICY "Public read system settings"
  ON system_settings FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Admin write system settings" ON system_settings;
CREATE POLICY "Admin write system settings"
  ON system_settings FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');
