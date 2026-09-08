-- =============================================================================
-- SMART-BITE — SCHEMA CLEANUP & PRODUCTION-READY MIGRATION
-- Run ONCE in: Supabase Dashboard -> SQL Editor -> New Query -> Paste -> Run
--
-- What this does:
--   1. Drops 4 unused tables (roles, user_roles, stall_categories, vendor_payout_accounts)
--   2. Fixes role terminology: 'owner' -> 'vendor'
--   3. Ensures profiles has correct role + shop_id columns
--   4. Cleans legacy duplicate columns from stalls/menu_items/orders
--   5. Redesigns payments table for Razorpay/Cashfree/Stripe
--   6. Ensures receipts, audit_logs, notifications, system_settings exist
--   7. Adds proper indexes and RLS policies
--   8. Cleans test data (keeps admin accounts + stalls/menu data)
--
-- Idempotent: safe to re-run.
-- =============================================================================

BEGIN;

-- =============================================
-- STEP 1: DROP UNUSED & LEGACY TABLES
-- =============================================
DROP TABLE IF EXISTS public.profiles CASCADE;
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
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.stall_categories CASCADE;
DROP TABLE IF EXISTS public.vendor_payout_accounts CASCADE;

-- =============================================
-- STEP 2: FIX ROLE TERMINOLOGY (owner -> vendor)
-- =============================================
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_role_check;
UPDATE public.accounts SET role = 'vendor' WHERE role = 'owner';
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_role_check CHECK (role IN ('student', 'vendor', 'admin'));

-- =============================================
-- STEP 3: ENSURE admin_allowlist EXISTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.admin_allowlist (email) VALUES
  ('omgarkal357@gmail.com'),
  ('omgarkal359@gmail.com'),
  ('admin@smartbite.in')
ON CONFLICT (email) DO NOTHING;

-- =============================================
-- STEP 4: FIX handle_new_user TRIGGER (vendor not owner)
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT := LOWER(COALESCE(NEW.email, ''));
  v_meta_role TEXT := COALESCE(NEW.raw_app_meta_data ->> 'role', NEW.raw_user_meta_data ->> 'role');
  v_role  TEXT := 'student';
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

-- =============================================
-- STEP 4b: BACKFILL ALL EXISTING auth.users INTO public.accounts
-- =============================================
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

-- =============================================
-- STEP 5: FIX is_admin() and owns_stall() FUNCTIONS
-- =============================================
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

-- Drop the old is_vendor_owner and is_vendor_of_stall functions (from master schema)
DROP FUNCTION IF EXISTS public.is_vendor_owner(UUID);
DROP FUNCTION IF EXISTS public.is_vendor_of_stall(TEXT);

-- =============================================
-- STEP 6: CLEAN STALLS (drop legacy columns if they exist)
-- =============================================
ALTER TABLE public.stalls DROP COLUMN IF EXISTS online;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS busymode;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS waittime;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS maintenance_mode;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS category_id;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS provider_account_id;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS onboarding_status;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS settlement_status;

-- Ensure correct columns exist
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS busy_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS wait_time_minutes INTEGER DEFAULT 0;
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS vendor_id UUID;
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS operating_hours TEXT DEFAULT '08:00 AM - 08:00 PM';
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =============================================
-- STEP 7: CLEAN MENU_ITEMS (drop legacy columns if they exist)
-- =============================================
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS stallid;
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS isveg;
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS available;
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS is_vegetarian;
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS preparation_time;

-- Ensure correct columns exist
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS stall_id TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_veg BOOLEAN DEFAULT TRUE;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS category_id INTEGER;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =============================================
-- STEP 8: ENSURE VENDORS TABLE HAS ALL COLUMNS
-- =============================================
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS stall_id TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS fssai TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS account_holder TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS account_number_enc TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS account_last4 TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS ifsc TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS cashfree_vendor_id TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending';

-- Add unique constraint on stall_id for UPSERT support
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendors_stall_id_key') THEN
    ALTER TABLE public.vendors ADD CONSTRAINT vendors_stall_id_key UNIQUE (stall_id);
  END IF;
END $$;

-- =============================================
-- STEP 9: ENSURE vendor_invites EXISTS
-- =============================================
CREATE TABLE IF NOT EXISTS public.vendor_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token           UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  contact_email   TEXT NOT NULL,
  invitee_name    TEXT,
  required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_data  JSONB,
  status          TEXT NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent','submitted','approved','rejected')),
  stall_id        TEXT,
  reject_reason   TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STEP 10: REDESIGN PAYMENTS TABLE (gateway-ready)
-- =============================================
DROP TABLE IF EXISTS public.receipts CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;

CREATE TABLE public.payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  gateway             TEXT NOT NULL DEFAULT 'razorpay'
                        CHECK (gateway IN ('razorpay','cashfree','stripe','manual','cash')),
  gateway_order_id    TEXT,
  gateway_payment_id  TEXT UNIQUE,
  gateway_signature   TEXT,
  amount              NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency            TEXT DEFAULT 'INR',
  status              TEXT NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created','authorized','captured','failed','refunded','disputed')),
  method              TEXT,
  bank                TEXT,
  vpa                 TEXT,
  card_last4          TEXT,
  paid_at             TIMESTAMPTZ,
  failure_reason      TEXT,
  refund_id           TEXT,
  refund_amount       NUMERIC(12, 2),
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STEP 11: RECEIPTS TABLE
-- =============================================
CREATE TABLE public.receipts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_id      UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  receipt_number  TEXT UNIQUE NOT NULL,
  customer_name   TEXT,
  customer_email  TEXT,
  stall_name      TEXT,
  items_snapshot  JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal        NUMERIC(12, 2),
  tax_amount      NUMERIC(12, 2),
  total           NUMERIC(12, 2),
  payment_method  TEXT,
  receipt_url     TEXT,
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STEP 12: ENSURE AUDIT_LOGS, NOTIFICATIONS, SYSTEM_SETTINGS EXIST
-- =============================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          SERIAL PRIMARY KEY,
  actor_id    TEXT DEFAULT 'system',
  action      TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  severity    TEXT DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARN', 'SECURITY', 'CRITICAL')),
  status      TEXT DEFAULT 'SUCCESS',
  metadata    JSONB DEFAULT '{}'::jsonb,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id           SERIAL PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  is_read      BOOLEAN DEFAULT FALSE,
  metadata     JSONB DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  TEXT DEFAULT 'admin',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.system_settings (key, value, description) VALUES
  ('ordering_enabled', 'true'::jsonb, 'Global campus ordering system flag'),
  ('maintenance_mode', 'false'::jsonb, 'Platform maintenance mode flag'),
  ('platform_commission_percent', '10'::jsonb, 'Default platform commission rate percent'),
  ('payment_gateway', '"razorpay"'::jsonb, 'Active payment gateway: razorpay/cashfree/stripe'),
  ('razorpay_key_id', '""'::jsonb, 'Razorpay Key ID (public, used by frontend checkout)')
ON CONFLICT (key) DO NOTHING;

-- =============================================
-- STEP 13: INDEXES
-- =============================================
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

-- =============================================
-- STEP 14: ROW LEVEL SECURITY
-- =============================================
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

-- =============================================
-- STEP 15: RLS POLICIES (clean set)
-- =============================================

-- profiles
DROP POLICY IF EXISTS p_accounts_self_read ON public.accounts;
DROP POLICY IF EXISTS "Public read profiles" ON public.accounts;
DROP POLICY IF EXISTS p_accounts_read ON public.accounts;
CREATE POLICY p_accounts_read ON public.accounts FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS p_accounts_self_update ON public.accounts;
DROP POLICY IF EXISTS "Users update own profile" ON public.accounts;
DROP POLICY IF EXISTS p_accounts_update ON public.accounts;
CREATE POLICY p_accounts_update ON public.accounts FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS p_accounts_insert ON public.accounts;
CREATE POLICY p_accounts_insert ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- admin_allowlist
DROP POLICY IF EXISTS p_allowlist_admin ON public.admin_allowlist;
CREATE POLICY p_allowlist_admin ON public.admin_allowlist FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- vendors
DROP POLICY IF EXISTS p_vendors_read ON public.vendors;
DROP POLICY IF EXISTS "Public read active vendors" ON public.vendors;
CREATE POLICY p_vendors_read ON public.vendors FOR SELECT TO anon, authenticated
  USING (vendor_status = 'ACTIVE' OR public.is_admin());

DROP POLICY IF EXISTS p_vendors_manage ON public.vendors;
DROP POLICY IF EXISTS "Owner update vendor profile" ON public.vendors;
CREATE POLICY p_vendors_manage ON public.vendors FOR ALL TO authenticated
  USING (public.is_admin() OR user_id = auth.uid()) WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- vendor_invites
DROP POLICY IF EXISTS p_invites_admin ON public.vendor_invites;
CREATE POLICY p_invites_admin ON public.vendor_invites FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- stalls
DROP POLICY IF EXISTS p_stalls_read ON public.stalls;
DROP POLICY IF EXISTS "Public read stalls" ON public.stalls;
CREATE POLICY p_stalls_read ON public.stalls FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS p_stalls_update ON public.stalls;
DROP POLICY IF EXISTS "Vendor manage own stall" ON public.stalls;
CREATE POLICY p_stalls_update ON public.stalls FOR UPDATE TO authenticated
  USING (public.owns_stall(id)) WITH CHECK (public.owns_stall(id));

DROP POLICY IF EXISTS p_stalls_insert ON public.stalls;
CREATE POLICY p_stalls_insert ON public.stalls FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- menu_categories
DROP POLICY IF EXISTS p_cat_read ON public.menu_categories;
DROP POLICY IF EXISTS "Public read categories" ON public.menu_categories;
CREATE POLICY p_cat_read ON public.menu_categories FOR SELECT TO anon, authenticated
  USING (is_active OR public.is_admin());

DROP POLICY IF EXISTS p_cat_manage ON public.menu_categories;
DROP POLICY IF EXISTS "Vendor manage categories" ON public.menu_categories;
CREATE POLICY p_cat_manage ON public.menu_categories FOR ALL TO authenticated
  USING (public.owns_stall(stall_id)) WITH CHECK (public.owns_stall(stall_id));

-- menu_items
DROP POLICY IF EXISTS p_menu_read ON public.menu_items;
DROP POLICY IF EXISTS "Public read menu items" ON public.menu_items;
CREATE POLICY p_menu_read ON public.menu_items FOR SELECT TO anon, authenticated
  USING (is_available OR public.owns_stall(stall_id));

DROP POLICY IF EXISTS p_menu_manage ON public.menu_items;
DROP POLICY IF EXISTS "Vendor manage menu items" ON public.menu_items;
CREATE POLICY p_menu_manage ON public.menu_items FOR ALL TO authenticated
  USING (public.owns_stall(stall_id)) WITH CHECK (public.owns_stall(stall_id));

-- orders
DROP POLICY IF EXISTS p_orders_read ON public.orders;
DROP POLICY IF EXISTS "Customer and Vendor read orders" ON public.orders;
CREATE POLICY p_orders_read ON public.orders FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR customer_id = auth.uid()
    OR customer_email = LOWER(auth.jwt() ->> 'email')
    OR public.owns_stall(stall_id)
  );

DROP POLICY IF EXISTS p_orders_insert ON public.orders;
DROP POLICY IF EXISTS "Customer create own orders" ON public.orders;
CREATE POLICY p_orders_insert ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR customer_id = auth.uid()
    OR customer_email = LOWER(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS p_orders_update ON public.orders;
DROP POLICY IF EXISTS "Vendor update order status" ON public.orders;
CREATE POLICY p_orders_update ON public.orders FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.owns_stall(stall_id));

DROP POLICY IF EXISTS p_orders_delete ON public.orders;
CREATE POLICY p_orders_delete ON public.orders FOR DELETE TO authenticated
  USING (public.is_admin());

-- order_items
DROP POLICY IF EXISTS p_items_read ON public.order_items;
DROP POLICY IF EXISTS "Read order items" ON public.order_items;
CREATE POLICY p_items_read ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id));

DROP POLICY IF EXISTS p_items_insert ON public.order_items;
DROP POLICY IF EXISTS "Insert order items" ON public.order_items;
CREATE POLICY p_items_insert ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id
    AND (o.customer_id = auth.uid() OR o.customer_email = LOWER(auth.jwt() ->> 'email') OR public.is_admin())
  ));

-- order_status_history
DROP POLICY IF EXISTS p_hist_read ON public.order_status_history;
CREATE POLICY p_hist_read ON public.order_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id));

DROP POLICY IF EXISTS p_hist_insert ON public.order_status_history;
CREATE POLICY p_hist_insert ON public.order_status_history FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id AND public.owns_stall(o.stall_id)
  ));

-- payments
DROP POLICY IF EXISTS p_payments_read ON public.payments;
DROP POLICY IF EXISTS "Read payments" ON public.payments;
CREATE POLICY p_payments_read ON public.payments FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = payments.order_id
    AND (o.customer_id = auth.uid() OR o.customer_email = LOWER(auth.jwt() ->> 'email'))
  ));

DROP POLICY IF EXISTS p_payments_insert ON public.payments;
CREATE POLICY p_payments_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS p_payments_update ON public.payments;
CREATE POLICY p_payments_update ON public.payments FOR UPDATE TO authenticated
  USING (public.is_admin());

-- receipts
DROP POLICY IF EXISTS p_receipts_read ON public.receipts;
DROP POLICY IF EXISTS "Read receipts" ON public.receipts;
CREATE POLICY p_receipts_read ON public.receipts FOR SELECT TO authenticated
  USING (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = receipts.order_id
    AND (o.customer_id = auth.uid() OR o.customer_email = LOWER(auth.jwt() ->> 'email'))
  ));

DROP POLICY IF EXISTS p_receipts_insert ON public.receipts;
CREATE POLICY p_receipts_insert ON public.receipts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- audit_logs
DROP POLICY IF EXISTS p_audit_read ON public.audit_logs;
DROP POLICY IF EXISTS "Admin read audit logs" ON public.audit_logs;
CREATE POLICY p_audit_read ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS p_audit_insert ON public.audit_logs;
DROP POLICY IF EXISTS "Insert audit logs" ON public.audit_logs;
CREATE POLICY p_audit_insert ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- notifications
DROP POLICY IF EXISTS p_notif_read ON public.notifications;
DROP POLICY IF EXISTS "User read notifications" ON public.notifications;
CREATE POLICY p_notif_read ON public.notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid()::text OR recipient_id = (auth.jwt() ->> 'email') OR public.is_admin());

DROP POLICY IF EXISTS p_notif_insert ON public.notifications;
CREATE POLICY p_notif_insert ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS p_notif_update ON public.notifications;
CREATE POLICY p_notif_update ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid()::text OR public.is_admin());

-- system_settings
DROP POLICY IF EXISTS p_settings_read ON public.system_settings;
DROP POLICY IF EXISTS "Public read settings" ON public.system_settings;
CREATE POLICY p_settings_read ON public.system_settings FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS p_settings_manage ON public.system_settings;
DROP POLICY IF EXISTS "Admin manage settings" ON public.system_settings;
CREATE POLICY p_settings_manage ON public.system_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =============================================
-- STEP 16: REALTIME PUBLICATIONS
-- =============================================
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

-- =============================================
-- STEP 17: DATA CLEANUP
-- =============================================
DELETE FROM public.order_status_history;
DELETE FROM public.order_items;
DELETE FROM public.orders;
DELETE FROM public.menu_items;
DELETE FROM public.menu_categories;
DELETE FROM public.vendor_invites;
DELETE FROM public.vendors;

-- Re-seed vendor rows per stall
INSERT INTO public.vendors (stall_id, business_name, owner_name, vendor_status)
SELECT s.id, s.name, s.name, 'ACTIVE'
FROM public.stalls s
WHERE NOT EXISTS (SELECT 1 FROM public.vendors v WHERE v.stall_id = s.id);

-- Link stalls to vendor rows
UPDATE public.stalls s
SET vendor_id = v.id
FROM public.vendors v
WHERE v.stall_id = s.id AND s.vendor_id IS NULL;

-- Delete non-admin profiles
DELETE FROM public.accounts
WHERE email NOT IN ('omgarkal357@gmail.com', 'omgarkal359@gmail.com', 'admin@smartbite.in');

-- Clear audit/notifications
DELETE FROM public.audit_logs;
DELETE FROM public.notifications;

COMMIT;
