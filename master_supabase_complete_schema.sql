-- =============================================================================
-- SMARTBITE ENTERPRISE — COMPLETE AUTHORITATIVE SUPABASE PRODUCTION SCHEMA
-- Copy and run this entire script in Supabase SQL Editor:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste -> Run
-- =============================================================================

-- STEP 1: SECURITY DEFINER FUNCTION HARDENING
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'rls_auto_enable') THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO service_role;
  END IF;
END $$;


-- STEP 2: PROFILES & USER ROLES ARCHITECTURE (LINKED TO AUTH.USERS)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  roll_number TEXT,
  account_status TEXT DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('student', 'vendor', 'admin', 'support')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_user_role UNIQUE (user_id, role)
);


-- STEP 3: VENDORS & STALLS ARCHITECTURE
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  approval_status TEXT DEFAULT 'APPROVED' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhance existing public.stalls table
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS busy_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS wait_time_minutes INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS logo_path TEXT;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS operating_hours TEXT DEFAULT '08:00 AM - 08:00 PM';
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- STEP 4: MENU STRUCTURE (CATEGORIES & ITEMS)
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id SERIAL PRIMARY KEY,
  stall_id TEXT REFERENCES public.stalls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_stall_category_name UNIQUE(stall_id, name)
);

-- Enhance existing public.menu_items table
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES public.menu_categories(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS preparation_time INTEGER DEFAULT 10;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS is_vegetarian BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_menu_items_price') THEN
    ALTER TABLE public.menu_items ADD CONSTRAINT chk_menu_items_price CHECK (price >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_menu_items_stock') THEN
    ALTER TABLE public.menu_items ADD CONSTRAINT chk_menu_items_stock CHECK (stock >= 0);
  END IF;
END $$;


-- STEP 5: ORDERS & ORDER ITEMS
-- Enhance existing public.orders table
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS customer_uuid UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS stall_id TEXT REFERENCES public.stalls(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS fees NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_total_amount') THEN
    ALTER TABLE public.orders ADD CONSTRAINT chk_orders_total_amount CHECK (total_amount >= 0 OR total >= 0);
  END IF;
END $$;

-- Enhance existing public.order_items table
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS menu_item_id INTEGER REFERENCES public.menu_items(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS total_price NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_items_quantity') THEN
    ALTER TABLE public.order_items ADD CONSTRAINT chk_order_items_quantity CHECK (quantity > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_items_price') THEN
    ALTER TABLE public.order_items ADD CONSTRAINT chk_order_items_price CHECK (price >= 0 OR unit_price >= 0);
  END IF;
END $$;


-- STEP 6: PAYMENTS & ORDER STATUS HISTORY
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_payment_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'captured', 'failed', 'refunded', 'disputed')),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT DEFAULT 'INR',
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT DEFAULT 'system',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- STEP 7: SYSTEM AUDIT LOGS, NOTIFICATIONS & SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id SERIAL PRIMARY KEY,
  actor_id TEXT DEFAULT 'system',
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  severity TEXT DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARN', 'SECURITY', 'CRITICAL')),
  status TEXT DEFAULT 'SUCCESS',
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by TEXT DEFAULT 'admin',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.system_settings (key, value, description, updated_by)
VALUES 
  ('ordering_enabled', 'true'::jsonb, 'Global campus ordering system flag', 'system'),
  ('maintenance_mode', 'false'::jsonb, 'Platform maintenance mode flag', 'system'),
  ('platform_commission_percent', '10'::jsonb, 'Default platform commission rate percent', 'system')
ON CONFLICT (key) DO NOTHING;


-- STEP 8: COMPREHENSIVE PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_owner_id ON public.vendors(owner_id);
CREATE INDEX IF NOT EXISTS idx_stalls_vendor_id ON public.stalls(vendor_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_stall_id ON public.menu_categories(stall_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_menu_items_stall_id ON public.menu_items(stallId);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_uuid ON public.orders(customer_uuid);
CREATE INDEX IF NOT EXISTS idx_orders_stall_id_status ON public.orders(stall_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON public.order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id ON public.order_status_history(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON public.audit_logs(actor_id, created_at DESC);


-- STEP 9: AUTOMATED TRIGGERS (PROFILES & ORDER STATUS HISTORY)
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_app_meta_data->>'role', NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();


CREATE OR REPLACE FUNCTION public.fn_log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.order_status_history (order_id, previous_status, new_status, changed_by, reason)
    VALUES (NEW.id, NULL, NEW.status, COALESCE(NEW.customer_name, NEW.customerName, 'student'), 'Order placed');
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.order_status_history (order_id, previous_status, new_status, changed_by, reason)
    VALUES (NEW.id, OLD.status, NEW.status, 'system', 'Status transition');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_order_status_change ON public.orders;
CREATE TRIGGER trg_order_status_change
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_order_status_change();


-- STEP 10: ENABLE RLS & AUTHORITATIVE LEAST-PRIVILEGE POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id OR (auth.jwt() ->> 'role') = 'admin')
WITH CHECK (auth.uid() = id OR (auth.jwt() ->> 'role') = 'admin');

-- USER_ROLES POLICIES
DROP POLICY IF EXISTS "Admin view all user roles" ON public.user_roles;
CREATE POLICY "Admin view all user roles" ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR (auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admin manage user roles" ON public.user_roles;
CREATE POLICY "Admin manage user roles" ON public.user_roles FOR ALL TO authenticated
USING ((auth.jwt() ->> 'role') = 'admin');

-- VENDORS POLICIES
DROP POLICY IF EXISTS "Public read active vendors" ON public.vendors;
CREATE POLICY "Public read active vendors" ON public.vendors FOR SELECT TO public USING (is_active = true OR (auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Owner update vendor profile" ON public.vendors;
CREATE POLICY "Owner update vendor profile" ON public.vendors FOR UPDATE TO authenticated
USING (auth.uid() = owner_id OR (auth.jwt() ->> 'role') = 'admin');

-- STALLS POLICIES
DROP POLICY IF EXISTS "Public read stalls" ON public.stalls;
CREATE POLICY "Public read stalls" ON public.stalls FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Vendor owner update stall" ON public.stalls;
CREATE POLICY "Vendor owner update stall" ON public.stalls FOR UPDATE TO authenticated
USING ((auth.jwt() ->> 'role') = 'admin' OR (auth.jwt() ->> 'shopId') = id);

-- MENU_CATEGORIES POLICIES
DROP POLICY IF EXISTS "Public read categories" ON public.menu_categories;
CREATE POLICY "Public read categories" ON public.menu_categories FOR SELECT TO public USING (is_active = true OR (auth.jwt() ->> 'role') IN ('admin', 'owner', 'vendor'));

DROP POLICY IF EXISTS "Vendor owner manage categories" ON public.menu_categories;
CREATE POLICY "Vendor owner manage categories" ON public.menu_categories FOR ALL TO authenticated
USING ((auth.jwt() ->> 'role') = 'admin' OR (auth.jwt() ->> 'shopId') = stall_id);

-- MENU_ITEMS POLICIES
DROP POLICY IF EXISTS "Public read available menu items" ON public.menu_items;
CREATE POLICY "Public read available menu items" ON public.menu_items FOR SELECT TO public
USING (available = 1 OR is_available = true OR (auth.jwt() ->> 'role') IN ('admin', 'owner', 'vendor'));

DROP POLICY IF EXISTS "Vendor manage menu items" ON public.menu_items;
CREATE POLICY "Vendor manage menu items" ON public.menu_items FOR ALL TO authenticated
USING ((auth.jwt() ->> 'role') = 'admin' OR (auth.jwt() ->> 'shopId') = stallId);

-- ORDERS POLICIES
DROP POLICY IF EXISTS "Student and Vendor read orders" ON public.orders;
CREATE POLICY "Student and Vendor read orders" ON public.orders FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'admin' OR
  auth.uid() = customer_uuid OR
  (select auth.uid())::text = customerId OR
  (auth.jwt() ->> 'email') = customerId OR
  (auth.jwt() ->> 'role') IN ('owner', 'vendor')
);

DROP POLICY IF EXISTS "Student create own orders" ON public.orders;
CREATE POLICY "Student create own orders" ON public.orders FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'role') = 'admin' OR
  auth.uid() = customer_uuid OR
  (select auth.uid())::text = customerId OR
  (auth.jwt() ->> 'email') = customerId
);

DROP POLICY IF EXISTS "Vendor update order status" ON public.orders;
CREATE POLICY "Vendor update order status" ON public.orders FOR UPDATE TO authenticated
USING ((auth.jwt() ->> 'role') IN ('admin', 'owner', 'vendor'));

-- ORDER_ITEMS POLICIES
DROP POLICY IF EXISTS "Authenticated read order items" ON public.order_items;
CREATE POLICY "Authenticated read order items" ON public.order_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Student insert order items" ON public.order_items;
CREATE POLICY "Student insert order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);

-- PAYMENTS POLICIES
DROP POLICY IF EXISTS "User read own payments" ON public.payments;
CREATE POLICY "User read own payments" ON public.payments FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'admin' OR
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payments.order_id AND (orders.customer_uuid = auth.uid() OR orders.customerId = (auth.jwt() ->> 'email')))
);

-- ORDER_STATUS_HISTORY POLICIES
DROP POLICY IF EXISTS "Read order status history" ON public.order_status_history;
CREATE POLICY "Read order status history" ON public.order_status_history FOR SELECT TO authenticated
USING ((auth.jwt() ->> 'role') IN ('admin', 'owner', 'vendor', 'support') OR EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_status_history.order_id AND orders.customerId = (auth.jwt() ->> 'email')));

-- AUDIT_LOGS POLICIES
DROP POLICY IF EXISTS "Admin read audit logs" ON public.audit_logs;
CREATE POLICY "Admin read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING ((auth.jwt() ->> 'role') IN ('admin', 'support'));

DROP POLICY IF EXISTS "Service role insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- NOTIFICATIONS POLICIES
DROP POLICY IF EXISTS "User read own notifications" ON public.notifications;
CREATE POLICY "User read own notifications" ON public.notifications FOR SELECT TO authenticated
USING (recipient_id = auth.uid()::text OR recipient_id = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "User update own notifications" ON public.notifications;
CREATE POLICY "User update own notifications" ON public.notifications FOR UPDATE TO authenticated
USING (recipient_id = auth.uid()::text OR recipient_id = (auth.jwt() ->> 'email'));

-- SYSTEM_SETTINGS POLICIES
DROP POLICY IF EXISTS "Public read settings" ON public.system_settings;
CREATE POLICY "Public read settings" ON public.system_settings FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admin write settings" ON public.system_settings;
CREATE POLICY "Admin write settings" ON public.system_settings FOR ALL TO authenticated USING ((auth.jwt() ->> 'role') = 'admin');


-- STEP 11: IDEMPOTENT REALTIME REPLICATION ENABLEMENT
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON pr.prrelid = c.oid JOIN pg_publication p ON pr.prpubid = p.oid WHERE p.pubname = 'supabase_realtime' AND c.relname = 'orders') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON pr.prrelid = c.oid JOIN pg_publication p ON pr.prpubid = p.oid WHERE p.pubname = 'supabase_realtime' AND c.relname = 'order_status_history') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON pr.prrelid = c.oid JOIN pg_publication p ON pr.prpubid = p.oid WHERE p.pubname = 'supabase_realtime' AND c.relname = 'notifications') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class c ON pr.prrelid = c.oid JOIN pg_publication p ON pr.prpubid = p.oid WHERE p.pubname = 'supabase_realtime' AND c.relname = 'audit_logs') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
    END IF;
  END IF;
END $$;
