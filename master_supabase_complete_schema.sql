-- =============================================================================
-- SMARTBITE ENTERPRISE — COMPLETE AUTHORITATIVE 14-DOMAIN SUPABASE SCHEMA
-- Copy and run this entire script in Supabase SQL Editor:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste -> Run
-- =============================================================================

BEGIN;

-- 1. ADMIN ALLOWLIST
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.admin_allowlist (email) VALUES
  ('omgarkal357@gmail.com'),
  ('omgarkal359@gmail.com'),
  ('admin@smartbite.in')
ON CONFLICT (email) DO NOTHING;

-- 2. AUTHENTICATION PROFILES (Single identity table linked 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  display_name TEXT,
  phone TEXT,
  roll_number TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'vendor', 'admin')),
  shop_id TEXT,
  account_status TEXT DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT := LOWER(COALESCE(NEW.email, ''));
  v_meta_role TEXT := COALESCE(NEW.raw_app_meta_data ->> 'role', NEW.raw_user_meta_data ->> 'role');
  v_role TEXT := 'student';
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = v_email) THEN
    v_role := 'admin';
  ELSIF v_meta_role IN ('vendor', 'owner') THEN
    v_role := 'vendor';
  END IF;

  INSERT INTO public.accounts (id, email, full_name, role, shop_id)
  VALUES (
    NEW.id,
    v_email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(v_email,'@',1)),
    v_role,
    NEW.raw_app_meta_data ->> 'shopId'
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- BACKFILL ALL EXISTING auth.users INTO public.accounts
INSERT INTO public.accounts (id, email, full_name, role, shop_id)
SELECT 
  u.id,
  LOWER(COALESCE(u.email, '')),
  COALESCE(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.email = LOWER(COALESCE(u.email, ''))) THEN 'admin'
    WHEN COALESCE(u.raw_app_meta_data ->> 'role', u.raw_user_meta_data ->> 'role') IN ('vendor', 'owner') THEN 'vendor'
    ELSE 'student'
  END AS role,
  u.raw_app_meta_data ->> 'shopId' AS shop_id
FROM auth.users u
ON CONFLICT (id) DO UPDATE SET 
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  shop_id = COALESCE(public.accounts.shop_id, EXCLUDED.shop_id);

-- Auth helper functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_allowlist
    WHERE email = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  ) OR EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

CREATE OR REPLACE FUNCTION public.owns_stall(p_stall_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_stall_id IS NULL OR TRIM(p_stall_id) = '' THEN RETURN FALSE; END IF;
  IF public.is_admin() THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = auth.uid() AND role = 'vendor' AND shop_id = p_stall_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- 3. VENDORS
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stall_id TEXT UNIQUE,
  user_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  owner_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  vendor_status TEXT DEFAULT 'ACTIVE' CHECK (vendor_status IN ('PENDING', 'ACTIVE', 'SUSPENDED')),
  fssai TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  account_holder TEXT,
  account_number_enc TEXT,
  account_last4 TEXT,
  ifsc TEXT,
  upi_id TEXT,
  cashfree_vendor_id TEXT,
  payout_status TEXT DEFAULT 'pending' CHECK (payout_status IN ('pending', 'registered', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. VENDOR INVITES
CREATE TABLE IF NOT EXISTS public.vendor_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  contact_email TEXT NOT NULL,
  invitee_name TEXT,
  required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_data JSONB,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'submitted', 'approved', 'rejected')),
  stall_id TEXT,
  reject_reason TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. STALLS
CREATE TABLE IF NOT EXISTS public.stalls (
  id TEXT PRIMARY KEY,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  operating_hours TEXT DEFAULT '08:00 AM - 08:00 PM',
  img TEXT,
  logo TEXT,
  rating NUMERIC(3, 2) DEFAULT 4.5,
  is_active BOOLEAN DEFAULT TRUE,
  is_online BOOLEAN DEFAULT TRUE,
  busy_mode BOOLEAN DEFAULT FALSE,
  wait_time_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MENU CATEGORIES
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id SERIAL PRIMARY KEY,
  stall_id TEXT NOT NULL REFERENCES public.stalls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_stall_category UNIQUE (stall_id, name)
);

-- 7. MENU ITEMS
CREATE TABLE IF NOT EXISTS public.menu_items (
  id SERIAL PRIMARY KEY,
  stall_id TEXT NOT NULL REFERENCES public.stalls(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  category TEXT,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  stock INTEGER DEFAULT 100 CHECK (stock >= 0),
  img TEXT,
  is_veg BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_number TEXT,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email TEXT,
  customer_name TEXT,
  stall_id TEXT REFERENCES public.stalls(id) ON DELETE SET NULL,
  stall_name TEXT,
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'pending_cash', 'preparing', 'ready', 'completed', 'cancelled')),
  payment_method TEXT DEFAULT 'Cash',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  subtotal NUMERIC(12, 2) DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) DEFAULT 0.00,
  total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id INTEGER REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  stall_id TEXT REFERENCES public.stalls(id) ON DELETE SET NULL,
  stall_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ORDER STATUS HISTORY
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. PAYMENTS (Gateway ready)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  gateway TEXT NOT NULL DEFAULT 'razorpay' CHECK (gateway IN ('razorpay', 'cashfree', 'stripe', 'manual', 'cash')),
  gateway_order_id TEXT,
  gateway_payment_id TEXT UNIQUE,
  gateway_signature TEXT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded', 'disputed')),
  method TEXT,
  bank TEXT,
  vpa TEXT,
  card_last4 TEXT,
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  refund_id TEXT,
  refund_amount NUMERIC(12, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. RECEIPTS
CREATE TABLE IF NOT EXISTS public.receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  receipt_number TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  customer_email TEXT,
  stall_name TEXT,
  items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12, 2),
  tax_amount NUMERIC(12, 2),
  total NUMERIC(12, 2),
  payment_method TEXT,
  receipt_url TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. AUDIT LOGS
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

-- 14. NOTIFICATIONS & SYSTEM SETTINGS
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

INSERT INTO public.system_settings (key, value, description) VALUES
  ('ordering_enabled', 'true'::jsonb, 'Global campus ordering system flag'),
  ('maintenance_mode', 'false'::jsonb, 'Platform maintenance mode flag'),
  ('platform_commission_percent', '10'::jsonb, 'Default platform commission rate percent'),
  ('payment_gateway', '"razorpay"'::jsonb, 'Active payment gateway: razorpay/cashfree/stripe'),
  ('razorpay_key_id', '""'::jsonb, 'Razorpay Key ID (public, used by frontend checkout)')
ON CONFLICT (key) DO NOTHING;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_accounts_email ON public.accounts(email);
CREATE INDEX IF NOT EXISTS idx_admin_allowlist_email ON public.admin_allowlist(email);
CREATE INDEX IF NOT EXISTS idx_vendors_stall_id ON public.vendors(stall_id);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON public.vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invites_token ON public.vendor_invites(token);
CREATE INDEX IF NOT EXISTS idx_vendor_invites_status ON public.vendor_invites(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stalls_vendor_id ON public.stalls(vendor_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_stall ON public.menu_items(stall_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_stall ON public.menu_categories(stall_id, display_order);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_stall_status ON public.orders(stall_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_stall ON public.order_items(stall_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_id ON public.payments(gateway_payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_order ON public.receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, created_at DESC);

-- ROW LEVEL SECURITY
ALTER TABLE public.accounts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_allowlist    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_invites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stalls             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings    ENABLE ROW LEVEL SECURITY;

-- POLICIES
CREATE POLICY p_accounts_read ON public.accounts FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY p_accounts_update ON public.accounts FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY p_accounts_insert ON public.accounts FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY p_allowlist_admin ON public.admin_allowlist FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY p_vendors_read ON public.vendors FOR SELECT TO anon, authenticated USING (vendor_status = 'ACTIVE' OR public.is_admin());
CREATE POLICY p_vendors_manage ON public.vendors FOR ALL TO authenticated USING (public.is_admin() OR user_id = auth.uid()) WITH CHECK (public.is_admin() OR user_id = auth.uid());

CREATE POLICY p_invites_admin ON public.vendor_invites FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY p_stalls_read ON public.stalls FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY p_stalls_update ON public.stalls FOR UPDATE TO authenticated USING (public.owns_stall(id)) WITH CHECK (public.owns_stall(id));
CREATE POLICY p_stalls_insert ON public.stalls FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY p_cat_read ON public.menu_categories FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin());
CREATE POLICY p_cat_manage ON public.menu_categories FOR ALL TO authenticated USING (public.owns_stall(stall_id)) WITH CHECK (public.owns_stall(stall_id));

CREATE POLICY p_menu_read ON public.menu_items FOR SELECT TO anon, authenticated USING (is_available OR public.owns_stall(stall_id));
CREATE POLICY p_menu_manage ON public.menu_items FOR ALL TO authenticated USING (public.owns_stall(stall_id)) WITH CHECK (public.owns_stall(stall_id));

CREATE POLICY p_orders_read ON public.orders FOR SELECT TO authenticated USING (public.is_admin() OR customer_id = auth.uid() OR customer_email = LOWER(auth.jwt() ->> 'email') OR public.owns_stall(stall_id));
CREATE POLICY p_orders_insert ON public.orders FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR customer_id = auth.uid() OR customer_email = LOWER(auth.jwt() ->> 'email'));
CREATE POLICY p_orders_update ON public.orders FOR UPDATE TO authenticated USING (public.is_admin() OR public.owns_stall(stall_id));
CREATE POLICY p_orders_delete ON public.orders FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY p_items_read ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id));
CREATE POLICY p_items_insert ON public.order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.customer_id = auth.uid() OR o.customer_email = LOWER(auth.jwt() ->> 'email') OR public.is_admin())));

CREATE POLICY p_hist_read ON public.order_status_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id));
CREATE POLICY p_hist_insert ON public.order_status_history FOR INSERT TO authenticated WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id AND public.owns_stall(o.stall_id)));

CREATE POLICY p_payments_read ON public.payments FOR SELECT TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payments.order_id AND (o.customer_id = auth.uid() OR o.customer_email = LOWER(auth.jwt() ->> 'email'))));
CREATE POLICY p_payments_insert ON public.payments FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY p_payments_update ON public.payments FOR UPDATE TO authenticated USING (public.is_admin());

CREATE POLICY p_receipts_read ON public.receipts FOR SELECT TO authenticated USING (public.is_admin() OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = receipts.order_id AND (o.customer_id = auth.uid() OR o.customer_email = LOWER(auth.jwt() ->> 'email'))));
CREATE POLICY p_receipts_insert ON public.receipts FOR INSERT TO authenticated WITH CHECK (public.is_admin());

CREATE POLICY p_audit_read ON public.audit_logs FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY p_audit_insert ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY p_notif_read ON public.notifications FOR SELECT TO authenticated USING (recipient_id = auth.uid()::text OR recipient_id = (auth.jwt() ->> 'email') OR public.is_admin());
CREATE POLICY p_notif_insert ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY p_notif_update ON public.notifications FOR UPDATE TO authenticated USING (recipient_id = auth.uid()::text OR public.is_admin());

CREATE POLICY p_settings_read ON public.system_settings FOR SELECT TO public USING (true);
CREATE POLICY p_settings_manage ON public.system_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- REALTIME
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stalls;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

COMMIT;
