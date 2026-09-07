-- =============================================================================
-- MIGRATION 017: AUTHORITATIVE ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_payout_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stall_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- 2. VENDORS
DROP POLICY IF EXISTS "Public read active vendors" ON public.vendors;
CREATE POLICY "Public read active vendors" ON public.vendors FOR SELECT TO public USING (vendor_status = 'ACTIVE' OR public.is_admin());

DROP POLICY IF EXISTS "Owner update vendor profile" ON public.vendors;
CREATE POLICY "Owner update vendor profile" ON public.vendors FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- 3. VENDOR PAYOUT ACCOUNTS (STRICT SECURITY - 0 STUDENT ACCESS)
DROP POLICY IF EXISTS "Vendor owner manage payout accounts" ON public.vendor_payout_accounts;
CREATE POLICY "Vendor owner manage payout accounts" ON public.vendor_payout_accounts FOR ALL TO authenticated
USING (public.is_admin() OR public.is_vendor_owner(vendor_id))
WITH CHECK (public.is_admin() OR public.is_vendor_owner(vendor_id));

-- 4. STALLS
DROP POLICY IF EXISTS "Public read stalls" ON public.stalls;
CREATE POLICY "Public read stalls" ON public.stalls FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Vendor manage own stall" ON public.stalls;
CREATE POLICY "Vendor manage own stall" ON public.stalls FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_vendor_of_stall(id));

-- 5. MENU CATEGORIES & ITEMS
DROP POLICY IF EXISTS "Public read categories" ON public.menu_categories;
CREATE POLICY "Public read categories" ON public.menu_categories FOR SELECT TO public USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Vendor manage categories" ON public.menu_categories;
CREATE POLICY "Vendor manage categories" ON public.menu_categories FOR ALL TO authenticated
USING (public.is_admin() OR public.is_vendor_of_stall(stall_id));

DROP POLICY IF EXISTS "Public read menu items" ON public.menu_items;
CREATE POLICY "Public read menu items" ON public.menu_items FOR SELECT TO public
USING (available = 1 OR is_available = true OR public.is_admin());

DROP POLICY IF EXISTS "Vendor manage menu items" ON public.menu_items;
CREATE POLICY "Vendor manage menu items" ON public.menu_items FOR ALL TO authenticated
USING (public.is_admin() OR public.is_vendor_of_stall(stallId));

-- 6. ORDERS & ORDER ITEMS
DROP POLICY IF EXISTS "Customer and Vendor read orders" ON public.orders;
CREATE POLICY "Customer and Vendor read orders" ON public.orders FOR SELECT TO authenticated
USING (
  public.is_admin() OR
  auth.uid() = customer_uuid OR
  (auth.jwt() ->> 'email') = customerId OR
  public.is_vendor_of_stall(stall_id) OR
  public.is_vendor_of_stall(stallId)
);

DROP POLICY IF EXISTS "Customer create own orders" ON public.orders;
CREATE POLICY "Customer create own orders" ON public.orders FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin() OR
  auth.uid() = customer_uuid OR
  (auth.jwt() ->> 'email') = customerId
);

DROP POLICY IF EXISTS "Vendor update order status" ON public.orders;
CREATE POLICY "Vendor update order status" ON public.orders FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_vendor_of_stall(stall_id) OR public.is_vendor_of_stall(stallId));

DROP POLICY IF EXISTS "Read order items" ON public.order_items;
CREATE POLICY "Read order items" ON public.order_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert order items" ON public.order_items;
CREATE POLICY "Insert order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);

-- 7. PAYMENTS & RECEIPTS
DROP POLICY IF EXISTS "Read payments" ON public.payments;
CREATE POLICY "Read payments" ON public.payments FOR SELECT TO authenticated
USING (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payments.order_id AND (orders.customer_uuid = auth.uid() OR orders.customerId = (auth.jwt() ->> 'email')))
);

DROP POLICY IF EXISTS "Read receipts" ON public.receipts;
CREATE POLICY "Read receipts" ON public.receipts FOR SELECT TO authenticated
USING (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = receipts.order_id AND (orders.customer_uuid = auth.uid() OR orders.customerId = (auth.jwt() ->> 'email')))
);

-- 8. AUDIT LOGS, NOTIFICATIONS & SETTINGS
DROP POLICY IF EXISTS "Admin read audit logs" ON public.audit_logs;
CREATE POLICY "Admin read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Insert audit logs" ON public.audit_logs;
CREATE POLICY "Insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "User read notifications" ON public.notifications;
CREATE POLICY "User read notifications" ON public.notifications FOR SELECT TO authenticated
USING (recipient_id = auth.uid()::text OR recipient_id = (auth.jwt() ->> 'email') OR public.is_admin());

DROP POLICY IF EXISTS "Public read settings" ON public.system_settings;
CREATE POLICY "Public read settings" ON public.system_settings FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admin manage settings" ON public.system_settings;
CREATE POLICY "Admin manage settings" ON public.system_settings FOR ALL TO authenticated USING (public.is_admin());
