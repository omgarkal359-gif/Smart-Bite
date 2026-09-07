-- =============================================================================
-- SMARTBITE ENTERPRISE — COMPLETE AUTHORITATIVE 17-DOMAIN SUPABASE SCHEMA
-- Copy and run this entire script in Supabase SQL Editor:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste -> Run
-- =============================================================================

-- DOMAIN 1 & 2: AUTHENTICATION PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  roll_number TEXT,
  avatar_url TEXT,
  account_status TEXT DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOMAIN 3: ROLE BASED ACCESS CONTROL (RBAC)
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL CHECK (name IN ('admin', 'vendor', 'student', 'support')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.roles (name, description)
VALUES 
  ('admin', 'Super administrator with full platform governance'),
  ('vendor', 'Stall business owner and manager'),
  ('student', 'Campus food court customer'),
  ('support', 'Customer support and order fulfillment staff')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_user_role UNIQUE (user_id, role_id)
);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  IF v_email IN ('omgarkal357@gmail.com', 'omgarkal359@gmail.com') THEN
    RETURN TRUE;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid() AND r.name = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- DOMAIN 4: VENDORS & PAYOUT ACCOUNTS
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  owner_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  vendor_status TEXT DEFAULT 'ACTIVE' CHECK (vendor_status IN ('PENDING', 'ACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vendor_payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  account_holder_name TEXT,
  bank_name TEXT,
  account_number_encrypted TEXT,
  ifsc_code TEXT,
  upi_id TEXT,
  is_primary BOOLEAN DEFAULT TRUE,
  verification_status TEXT DEFAULT 'VERIFIED' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.is_vendor_owner(p_vendor_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.vendors
    WHERE id = p_vendor_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- DOMAIN 5 & 6: STALLS & STALL CATEGORIES
CREATE TABLE IF NOT EXISTS public.stall_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.stall_categories (name, description, icon)
VALUES
  ('Fast Food & Snacks', 'Quick bites, wadapav, samosas and snacks', '🥟'),
  ('Beverages & Desserts', 'Teas, coffees, shakes and desserts', '☕'),
  ('South Indian', 'Idli, dosa, vada and South Indian delights', '🥘'),
  ('Chinese & Noodles', 'Noodles, fried rice and Indo-Chinese fusion', '🍜'),
  ('Snacks & Beverages', 'General beverages and multi-cuisine snacks', '🥪')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.stall_categories(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS busy_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS wait_time_minutes INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS operating_hours TEXT DEFAULT '08:00 AM - 08:00 PM';
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.is_vendor_of_stall(p_stall_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_stall_id IS NULL OR TRIM(p_stall_id) = '' THEN
    RETURN FALSE;
  END IF;
  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;
  IF (auth.jwt() ->> 'shopId') = p_stall_id THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.stalls s
    JOIN public.vendors v ON s.vendor_id = v.id
    WHERE s.id = p_stall_id AND v.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- DOMAIN 8 & 9: MENU CATEGORIES & MENU ITEMS
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id SERIAL PRIMARY KEY,
  stall_id TEXT NOT NULL REFERENCES public.stalls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_stall_category_name UNIQUE(stall_id, name)
);

ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES public.menu_categories(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS preparation_time INTEGER DEFAULT 10;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS is_vegetarian BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_menu_items_price_nonnegative') THEN
    ALTER TABLE public.menu_items ADD CONSTRAINT chk_menu_items_price_nonnegative CHECK (price >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_menu_items_stock_nonnegative') THEN
    ALTER TABLE public.menu_items ADD CONSTRAINT chk_menu_items_stock_nonnegative CHECK (stock >= 0);
  END IF;
END $$;

-- DOMAIN 10, 11 & 12: ORDERS, ITEMS & HISTORY
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS customer_uuid UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS customerid TEXT;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS stall_id TEXT REFERENCES public.stalls(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS stallid TEXT REFERENCES public.stalls(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS stallId TEXT REFERENCES public.stalls(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS stall_name_snapshot TEXT;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS orderid TEXT;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS stallid TEXT;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS stall_id TEXT;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS stallId TEXT;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS menu_item_id INTEGER REFERENCES public.menu_items(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS item_name_snapshot TEXT;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS unit_price_snapshot NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS total_price NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT DEFAULT 'system',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOMAIN 13 & 14: PAYMENTS & RECEIPTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL,
  payment_provider TEXT,
  provider_payment_id TEXT UNIQUE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'captured', 'failed', 'refunded', 'disputed')),
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  receipt_number TEXT UNIQUE NOT NULL,
  receipt_url TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOMAIN 15, 16 & 17: SYSTEM GOVERNANCE
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

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON public.vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payout_vendor_id ON public.vendor_payout_accounts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_stalls_vendor_id ON public.stalls(vendor_id);
CREATE INDEX IF NOT EXISTS idx_stalls_category_id ON public.stalls(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_stall_id ON public.menu_categories(stall_id, display_order);
CREATE INDEX IF NOT EXISTS idx_menu_items_stall_id ON public.menu_items(stallId);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_uuid ON public.orders(customer_uuid);
CREATE INDEX IF NOT EXISTS idx_orders_stall_id_status ON public.orders(stall_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_receipts_order_id ON public.receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON public.audit_logs(actor_id, created_at DESC);

-- RLS & AUTHORIZATION POLICIES
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

-- POLICIES
DROP POLICY IF EXISTS "Public read profiles" ON public.profiles;
CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_admin()) WITH CHECK (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Public read active vendors" ON public.vendors;
CREATE POLICY "Public read active vendors" ON public.vendors FOR SELECT TO public USING (vendor_status = 'ACTIVE' OR public.is_admin());

DROP POLICY IF EXISTS "Owner update vendor profile" ON public.vendors;
CREATE POLICY "Owner update vendor profile" ON public.vendors FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- STRICT PAYOUT PRIVACY POLICY (0 STUDENT ACCESS)
DROP POLICY IF EXISTS "Vendor owner manage payout accounts" ON public.vendor_payout_accounts;
CREATE POLICY "Vendor owner manage payout accounts" ON public.vendor_payout_accounts FOR ALL TO authenticated USING (public.is_admin() OR public.is_vendor_owner(vendor_id)) WITH CHECK (public.is_admin() OR public.is_vendor_owner(vendor_id));

DROP POLICY IF EXISTS "Public read stalls" ON public.stalls;
CREATE POLICY "Public read stalls" ON public.stalls FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Vendor manage own stall" ON public.stalls;
CREATE POLICY "Vendor manage own stall" ON public.stalls FOR UPDATE TO authenticated USING (public.is_admin() OR public.is_vendor_of_stall(id));

DROP POLICY IF EXISTS "Public read categories" ON public.menu_categories;
CREATE POLICY "Public read categories" ON public.menu_categories FOR SELECT TO public USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Vendor manage categories" ON public.menu_categories;
CREATE POLICY "Vendor manage categories" ON public.menu_categories FOR ALL TO authenticated USING (public.is_admin() OR public.is_vendor_of_stall(stall_id));

DROP POLICY IF EXISTS "Public read menu items" ON public.menu_items;
CREATE POLICY "Public read menu items" ON public.menu_items FOR SELECT TO public USING (available = 1 OR is_available = true OR public.is_admin());

DROP POLICY IF EXISTS "Vendor manage menu items" ON public.menu_items;
CREATE POLICY "Vendor manage menu items" ON public.menu_items FOR ALL TO authenticated USING (public.is_admin() OR public.is_vendor_of_stall(stallId));

DROP POLICY IF EXISTS "Customer and Vendor read orders" ON public.orders;
CREATE POLICY "Customer and Vendor read orders" ON public.orders FOR SELECT TO authenticated USING (
  public.is_admin() 
  OR auth.uid() = customer_uuid 
  OR (auth.jwt() ->> 'email') = customerId 
  OR (auth.jwt() ->> 'email') = customer_id
  OR (auth.jwt() ->> 'email') = customerid
  OR public.is_vendor_of_stall(stall_id) 
  OR public.is_vendor_of_stall(stallid)
  OR public.is_vendor_of_stall(stallId)
  OR EXISTS (
    SELECT 1 FROM public.order_items oi 
    WHERE (oi.orderid = orders.id OR oi.order_id = orders.id OR oi.orderId = orders.id) 
    AND (
      public.is_vendor_of_stall(oi.stallid) 
      OR public.is_vendor_of_stall(oi.stall_id) 
      OR public.is_vendor_of_stall(oi.stallId)
    )
  )
);

DROP POLICY IF EXISTS "Customer create own orders" ON public.orders;
CREATE POLICY "Customer create own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (
  public.is_admin() 
  OR auth.uid() = customer_uuid 
  OR (auth.jwt() ->> 'email') = customerId
  OR (auth.jwt() ->> 'email') = customer_id
  OR (auth.jwt() ->> 'email') = customerid
);

DROP POLICY IF EXISTS "Vendor update order status" ON public.orders;
CREATE POLICY "Vendor update order status" ON public.orders FOR UPDATE TO authenticated USING (
  public.is_admin() 
  OR public.is_vendor_of_stall(stall_id) 
  OR public.is_vendor_of_stall(stallid)
  OR public.is_vendor_of_stall(stallId)
  OR EXISTS (
    SELECT 1 FROM public.order_items oi 
    WHERE (oi.orderid = orders.id OR oi.order_id = orders.id OR oi.orderId = orders.id) 
    AND (
      public.is_vendor_of_stall(oi.stallid) 
      OR public.is_vendor_of_stall(oi.stall_id) 
      OR public.is_vendor_of_stall(oi.stallId)
    )
  )
);

DROP POLICY IF EXISTS "Read order items" ON public.order_items;
CREATE POLICY "Read order items" ON public.order_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Insert order items" ON public.order_items;
CREATE POLICY "Insert order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Read payments" ON public.payments;
CREATE POLICY "Read payments" ON public.payments FOR SELECT TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payments.order_id AND (orders.customer_uuid = auth.uid() OR orders.customerId = (auth.jwt() ->> 'email'))));

DROP POLICY IF EXISTS "Read receipts" ON public.receipts;
CREATE POLICY "Read receipts" ON public.receipts FOR SELECT TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.orders WHERE orders.id = receipts.order_id AND (orders.customer_uuid = auth.uid() OR orders.customerId = (auth.jwt() ->> 'email'))));

DROP POLICY IF EXISTS "Admin read audit logs" ON public.audit_logs;
CREATE POLICY "Admin read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Insert audit logs" ON public.audit_logs;
CREATE POLICY "Insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "User read notifications" ON public.notifications;
CREATE POLICY "User read notifications" ON public.notifications FOR SELECT TO authenticated USING (recipient_id = auth.uid()::text OR recipient_id = (auth.jwt() ->> 'email') OR public.is_admin());

DROP POLICY IF EXISTS "Public read settings" ON public.system_settings;
CREATE POLICY "Public read settings" ON public.system_settings FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admin manage settings" ON public.system_settings;
CREATE POLICY "Admin manage settings" ON public.system_settings FOR ALL TO authenticated USING (public.is_admin());
