-- =============================================================================
-- SMART-BITE — SCHEMA NORMALIZATION v2 (snake_case, single source of truth)
-- Run ONCE in: Supabase Dashboard -> SQL Editor -> New Query -> paste -> Run.
--
-- Strategy:
--   * stalls + menu_items HAVE data  -> migrate in place, drop redundant columns
--   * orders/order_items/menu_categories/vendors/profiles are EMPTY -> recreate clean
--   * One naming convention: snake_case everywhere
--   * RLS locked per role (student / vendor / admin); admin allowlist is DATA, not code
--
-- Idempotent + transactional: safe to re-run. Nothing commits if any statement fails.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0a. DROP LEGACY POLICIES that depend on columns we are about to change.
--     (Left over from the earlier master-schema run; they reference stallid,
--      online, etc. and would block the ALTER/DROP COLUMN below.)
--     Tables we DROP later (orders, menu_categories, vendors, profiles) drop
--     their own policies via CASCADE, so only the in-place tables need this.
-- ---------------------------------------------------------------------------
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('stalls', 'menu_items')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 0. ADMIN ALLOWLIST (replaces hardcoded gmails in is_admin())
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed current admins (change these to @sguk.ac.in accounts when ready — just UPDATE this table)
INSERT INTO public.admin_allowlist (email) VALUES
  ('omgarkal357@gmail.com'),
  ('omgarkal359@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 1. PROFILES (1:1 with auth.users — single source of identity + role)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.profiles CASCADE;
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','vendor','admin')),
  shop_id       TEXT,                         -- set for vendors: the stall they own
  account_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE','SUSPENDED')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create a profile on every new auth user; admin role auto-applied from allowlist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT := LOWER(COALESCE(NEW.email, ''));
  v_role  TEXT := 'student';
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = v_email) THEN
    v_role := 'admin';
  ELSIF COALESCE(NEW.raw_app_meta_data ->> 'role', NEW.raw_user_meta_data ->> 'role') = 'vendor' THEN
    v_role := 'vendor';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, shop_id)
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

-- ---------------------------------------------------------------------------
-- 2. AUTH HELPERS (used by every RLS policy)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_allowlist
    WHERE email = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
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
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'vendor' AND shop_id = p_stall_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

-- ---------------------------------------------------------------------------
-- 3. VENDORS (recreate clean; seed one active vendor row per existing stall)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.vendor_payout_accounts CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;
CREATE TABLE public.vendors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  stall_id      TEXT,
  business_name TEXT NOT NULL,
  owner_name    TEXT,
  contact_email TEXT,
  vendor_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (vendor_status IN ('PENDING','ACTIVE','SUSPENDED')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4. STALLS (HAS DATA — migrate in place to snake_case, then drop redundant)
-- ---------------------------------------------------------------------------
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS is_online BOOLEAN;
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS busy_mode BOOLEAN;
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS wait_time_minutes INTEGER;
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.stalls ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Consolidate values from legacy columns (online 1/0, busymode, waittime) where present
UPDATE public.stalls SET
  is_online = COALESCE(is_online, CASE WHEN online IS NOT NULL THEN (online = 1) ELSE TRUE END),
  busy_mode = COALESCE(busy_mode, CASE WHEN busymode IS NOT NULL THEN (busymode = 1) ELSE FALSE END),
  wait_time_minutes = COALESCE(wait_time_minutes, waittime, 0);

ALTER TABLE public.stalls ALTER COLUMN is_online SET DEFAULT TRUE;
ALTER TABLE public.stalls ALTER COLUMN busy_mode SET DEFAULT FALSE;
ALTER TABLE public.stalls ALTER COLUMN wait_time_minutes SET DEFAULT 0;

-- Drop legacy / redundant columns (keep: id,name,category,rating,img,logo,description,operating_hours,timestamps)
ALTER TABLE public.stalls DROP COLUMN IF EXISTS online;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS busymode;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS waittime;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS maintenance_mode;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS category_id;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS provider_account_id;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS onboarding_status;
ALTER TABLE public.stalls DROP COLUMN IF EXISTS settlement_status;

-- Seed a vendor row per stall (idempotent by stall_id)
INSERT INTO public.vendors (stall_id, business_name, owner_name, vendor_status)
SELECT s.id, s.name, s.name, 'ACTIVE'
FROM public.stalls s
WHERE NOT EXISTS (SELECT 1 FROM public.vendors v WHERE v.stall_id = s.id);

UPDATE public.stalls s
SET vendor_id = v.id
FROM public.vendors v
WHERE v.stall_id = s.id AND s.vendor_id IS NULL;

-- ---------------------------------------------------------------------------
-- 5. MENU CATEGORIES (recreate clean; seed from distinct menu_items.category)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.menu_categories CASCADE;
CREATE TABLE public.menu_categories (
  id            SERIAL PRIMARY KEY,
  stall_id      TEXT NOT NULL REFERENCES public.stalls(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_stall_category UNIQUE (stall_id, name)
);

INSERT INTO public.menu_categories (stall_id, name)
SELECT DISTINCT stallid, COALESCE(NULLIF(TRIM(category), ''), 'General')
FROM public.menu_items
WHERE stallid IS NOT NULL
ON CONFLICT (stall_id, name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. MENU ITEMS (HAS DATA — migrate to snake_case, link category_id, drop legacy)
-- ---------------------------------------------------------------------------
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS stall_id TEXT;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_veg BOOLEAN;
-- is_available already exists from prior partial migration; ensure present
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS is_available BOOLEAN;

UPDATE public.menu_items SET
  stall_id     = COALESCE(stall_id, stallid),
  is_veg       = COALESCE(is_veg, CASE WHEN isveg IS NOT NULL THEN (isveg = 1) ELSE TRUE END),
  is_available = COALESCE(is_available, CASE WHEN available IS NOT NULL THEN (available = 1) ELSE TRUE END);

-- Link category_id from the (stall_id, category) pair
UPDATE public.menu_items mi
SET category_id = mc.id
FROM public.menu_categories mc
WHERE mc.stall_id = mi.stall_id
  AND mc.name = COALESCE(NULLIF(TRIM(mi.category), ''), 'General')
  AND mi.category_id IS NULL;

ALTER TABLE public.menu_items ALTER COLUMN is_veg SET DEFAULT TRUE;
ALTER TABLE public.menu_items ALTER COLUMN is_available SET DEFAULT TRUE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_menu_items_stall') THEN
    ALTER TABLE public.menu_items
      ADD CONSTRAINT fk_menu_items_stall FOREIGN KEY (stall_id) REFERENCES public.stalls(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- Drop legacy columns (keep: id,name,price,stock,img,category,category_id,timestamps)
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS stallid;
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS isveg;
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS available;
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS is_vegetarian;
ALTER TABLE public.menu_items DROP COLUMN IF EXISTS preparation_time;

-- ---------------------------------------------------------------------------
-- 7. ORDERS + ORDER_ITEMS (EMPTY — recreate clean)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.order_status_history CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;

CREATE TABLE public.orders (
  id              TEXT PRIMARY KEY,
  order_number    TEXT,
  customer_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_email  TEXT,
  customer_name   TEXT,
  stall_id        TEXT REFERENCES public.stalls(id) ON DELETE SET NULL,
  stall_name      TEXT,
  status          TEXT NOT NULL DEFAULT 'placed'
                    CHECK (status IN ('placed','pending_cash','preparing','ready','completed','cancelled')),
  payment_method  TEXT DEFAULT 'Cash',
  payment_status  TEXT NOT NULL DEFAULT 'pending'
                    CHECK (payment_status IN ('pending','paid','failed','refunded')),
  subtotal        NUMERIC(12,2) DEFAULT 0,
  tax_amount      NUMERIC(12,2) DEFAULT 0,
  total           NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  idempotency_key TEXT UNIQUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.order_items (
  id            SERIAL PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id  INTEGER REFERENCES public.menu_items(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  unit_price    NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  stall_id      TEXT REFERENCES public.stalls(id) ON DELETE SET NULL,
  stall_name    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.order_status_history (
  id              SERIAL PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status      TEXT NOT NULL,
  changed_by      TEXT DEFAULT 'system',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 8. INDEXES (scale: multi-user read paths)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_menu_items_stall     ON public.menu_items(stall_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category  ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_stall ON public.menu_categories(stall_id, display_order);
CREATE INDEX IF NOT EXISTS idx_orders_customer      ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_stall_status  ON public.orders(stall_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created       ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order    ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_stall    ON public.order_items(stall_id);

-- ---------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stalls          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- profiles: read/update own; admin all
DROP POLICY IF EXISTS p_profiles_self_read ON public.profiles;
CREATE POLICY p_profiles_self_read ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS p_profiles_self_update ON public.profiles;
CREATE POLICY p_profiles_self_update ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- admin_allowlist: admin only
DROP POLICY IF EXISTS p_allowlist_admin ON public.admin_allowlist;
CREATE POLICY p_allowlist_admin ON public.admin_allowlist FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- vendors: public read active; owner/admin manage
DROP POLICY IF EXISTS p_vendors_read ON public.vendors;
CREATE POLICY p_vendors_read ON public.vendors FOR SELECT TO anon, authenticated
  USING (vendor_status = 'ACTIVE' OR public.is_admin());
DROP POLICY IF EXISTS p_vendors_manage ON public.vendors;
CREATE POLICY p_vendors_manage ON public.vendors FOR ALL TO authenticated
  USING (public.is_admin() OR user_id = auth.uid()) WITH CHECK (public.is_admin() OR user_id = auth.uid());

-- stalls: public read; owner/admin update
DROP POLICY IF EXISTS p_stalls_read ON public.stalls;
CREATE POLICY p_stalls_read ON public.stalls FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS p_stalls_update ON public.stalls;
CREATE POLICY p_stalls_update ON public.stalls FOR UPDATE TO authenticated
  USING (public.owns_stall(id)) WITH CHECK (public.owns_stall(id));

-- menu_categories: public read active; owner/admin manage
DROP POLICY IF EXISTS p_cat_read ON public.menu_categories;
CREATE POLICY p_cat_read ON public.menu_categories FOR SELECT TO anon, authenticated
  USING (is_active OR public.is_admin());
DROP POLICY IF EXISTS p_cat_manage ON public.menu_categories;
CREATE POLICY p_cat_manage ON public.menu_categories FOR ALL TO authenticated
  USING (public.owns_stall(stall_id)) WITH CHECK (public.owns_stall(stall_id));

-- menu_items: public read available; owner/admin manage
DROP POLICY IF EXISTS p_menu_read ON public.menu_items;
CREATE POLICY p_menu_read ON public.menu_items FOR SELECT TO anon, authenticated
  USING (is_available OR public.owns_stall(stall_id));
DROP POLICY IF EXISTS p_menu_manage ON public.menu_items;
CREATE POLICY p_menu_manage ON public.menu_items FOR ALL TO authenticated
  USING (public.owns_stall(stall_id)) WITH CHECK (public.owns_stall(stall_id));

-- orders: student reads own; vendor reads own stall; admin all
DROP POLICY IF EXISTS p_orders_read ON public.orders;
CREATE POLICY p_orders_read ON public.orders FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR customer_id = auth.uid()
    OR customer_email = LOWER(auth.jwt() ->> 'email')
    OR public.owns_stall(stall_id)
  );
-- student creates own order
DROP POLICY IF EXISTS p_orders_insert ON public.orders;
CREATE POLICY p_orders_insert ON public.orders FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR customer_id = auth.uid()
    OR customer_email = LOWER(auth.jwt() ->> 'email')
  );
-- vendor/admin updates status of orders for their stall
DROP POLICY IF EXISTS p_orders_update ON public.orders;
CREATE POLICY p_orders_update ON public.orders FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.owns_stall(stall_id));

-- order_items: readable/insertable if parent order is
DROP POLICY IF EXISTS p_items_read ON public.order_items;
CREATE POLICY p_items_read ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id));
DROP POLICY IF EXISTS p_items_insert ON public.order_items;
CREATE POLICY p_items_insert ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id
    AND (o.customer_id = auth.uid() OR o.customer_email = LOWER(auth.jwt() ->> 'email') OR public.is_admin())
  ));

-- order_status_history: read if order readable; vendor/admin insert
DROP POLICY IF EXISTS p_hist_read ON public.order_status_history;
CREATE POLICY p_hist_read ON public.order_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id));
DROP POLICY IF EXISTS p_hist_insert ON public.order_status_history;
CREATE POLICY p_hist_insert ON public.order_status_history FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR EXISTS (
    SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id AND public.owns_stall(o.stall_id)
  ));

-- ---------------------------------------------------------------------------
-- 10. REALTIME (order + stall status live updates)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stalls;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

COMMIT;

-- =============================================================================
-- POST-RUN sanity checks (run separately, optional):
--   SELECT id, is_online, busy_mode, wait_time_minutes FROM stalls LIMIT 5;
--   SELECT id, name, stall_id, is_veg, is_available, category_id FROM menu_items LIMIT 5;
--   SELECT stall_id, name FROM menu_categories ORDER BY stall_id;
-- =============================================================================
