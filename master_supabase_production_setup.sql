-- =============================================================================
-- SMARTBITE ENTERPRISE — MASTER SUPABASE PRODUCTION DATABASE SETUP & RLS FIX
-- Run this COMPLETE script in your Supabase SQL Editor to instantly fix all tables:
-- Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run
-- =============================================================================

-- STEP 1: SCHEMA NORMALIZATION & ADDITIVE COLUMNS
-- USERS
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS roll_number TEXT;
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'ACTIVE';
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_account_status') THEN
    ALTER TABLE public.users ADD CONSTRAINT chk_users_account_status CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'));
  END IF;
END $$;

-- STALLS
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS operating_hours TEXT DEFAULT '08:00 AM - 08:00 PM';
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- MENU_ITEMS
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS preparation_time INTEGER DEFAULT 10;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS category_id INTEGER;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
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

-- ORDERS
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS tax NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_total_amount') THEN
    ALTER TABLE public.orders ADD CONSTRAINT chk_orders_total_amount CHECK (total_amount >= 0 OR total >= 0);
  END IF;
END $$;

-- ORDER_ITEMS
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


-- STEP 2: CREATE AUXILIARY TABLES (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.menu_categories (
  id SERIAL PRIMARY KEY,
  stall_id TEXT NOT NULL REFERENCES public.stalls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_stall_category_name UNIQUE(stall_id, name)
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
  user_id TEXT NOT NULL,
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


-- STEP 3: PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customerId ON public.orders (customerId);
CREATE INDEX IF NOT EXISTS idx_orders_stall_id_status ON public.orders (stall_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_orderId ON public.order_items (orderId);
CREATE INDEX IF NOT EXISTS idx_order_items_stall_id ON public.order_items (stall_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_stall_id ON public.menu_items (stallId);
CREATE INDEX IF NOT EXISTS idx_menu_items_stall_category ON public.menu_items (stallId, category);
CREATE INDEX IF NOT EXISTS idx_menu_categories_stall ON public.menu_categories (stall_id, display_order);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_severity ON public.audit_logs (actor_id, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);


-- STEP 4: ORDER STATUS LIFECYCLE TRIGGER
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


-- STEP 5: PROFILES SECURITY VIEW (STRIPS PASSWORD FIELD FROM PUBLIC DATA ACCESS)
CREATE OR REPLACE VIEW public.profiles
WITH (security_invoker = true) AS
SELECT 
  id,
  username,
  name,
  role,
  shopId,
  phone,
  roll_number,
  account_status,
  created_at,
  updated_at
FROM public.users;

GRANT SELECT ON public.profiles TO authenticated, anon;


-- STEP 6: ENABLE ROW LEVEL SECURITY (RLS) ON ALL TABLES & DEFINE POLICIES
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.order_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_events ENABLE ROW LEVEL SECURITY;

-- POLICIES FOR USERS TABLE
DROP POLICY IF EXISTS "Users can read own record or admin" ON public.users;
CREATE POLICY "Users can read own record or admin" ON public.users FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'admin' OR
  (select auth.uid())::text = id::text OR
  (auth.jwt() ->> 'email') = username
);

DROP POLICY IF EXISTS "Admin update users" ON public.users;
CREATE POLICY "Admin update users" ON public.users FOR UPDATE TO authenticated
USING ((auth.jwt() ->> 'role') = 'admin') WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- POLICIES FOR STALLS TABLE
DROP POLICY IF EXISTS "Public read access for stalls" ON public.stalls;
CREATE POLICY "Public read access for stalls" ON public.stalls FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Vendor and Admin update access for stalls" ON public.stalls;
CREATE POLICY "Vendor and Admin update access for stalls" ON public.stalls FOR UPDATE TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'admin' OR 
  ((auth.jwt() ->> 'role') IN ('owner', 'vendor') AND (auth.jwt() ->> 'shopId') = id)
)
WITH CHECK (
  (auth.jwt() ->> 'role') = 'admin' OR 
  ((auth.jwt() ->> 'role') IN ('owner', 'vendor') AND (auth.jwt() ->> 'shopId') = id)
);

-- POLICIES FOR MENU_ITEMS TABLE
DROP POLICY IF EXISTS "Public read access for menu items" ON public.menu_items;
CREATE POLICY "Public read access for menu items" ON public.menu_items FOR SELECT TO public
USING (available = 1 OR is_available = true OR (auth.jwt() ->> 'role') IN ('admin', 'owner', 'vendor'));

DROP POLICY IF EXISTS "Vendor and Admin insert access for menu items" ON public.menu_items;
CREATE POLICY "Vendor and Admin insert access for menu items" ON public.menu_items FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'role') = 'admin' OR 
  ((auth.jwt() ->> 'role') IN ('owner', 'vendor') AND (auth.jwt() ->> 'shopId') = stallId)
);

DROP POLICY IF EXISTS "Vendor and Admin update access for menu items" ON public.menu_items;
CREATE POLICY "Vendor and Admin update access for menu items" ON public.menu_items FOR UPDATE TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'admin' OR 
  ((auth.jwt() ->> 'role') IN ('owner', 'vendor') AND (auth.jwt() ->> 'shopId') = stallId)
)
WITH CHECK (
  (auth.jwt() ->> 'role') = 'admin' OR 
  ((auth.jwt() ->> 'role') IN ('owner', 'vendor') AND (auth.jwt() ->> 'shopId') = stallId)
);

-- POLICIES FOR ORDERS TABLE
DROP POLICY IF EXISTS "Student and Vendor read access for orders" ON public.orders;
CREATE POLICY "Student and Vendor read access for orders" ON public.orders FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'admin' OR
  (select auth.uid())::text = customerId OR
  (select auth.uid())::text = customer_id OR
  (auth.jwt() ->> 'email') = customerId OR
  (auth.jwt() ->> 'email') = customer_id OR
  (auth.jwt() ->> 'role') IN ('owner', 'vendor')
);

DROP POLICY IF EXISTS "Authenticated student insert access for orders" ON public.orders;
CREATE POLICY "Authenticated student insert access for orders" ON public.orders FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'role') = 'admin' OR
  (select auth.uid())::text = customerId OR
  (select auth.uid())::text = customer_id OR
  (auth.jwt() ->> 'email') = customerId OR
  (auth.jwt() ->> 'email') = customer_id
);

DROP POLICY IF EXISTS "Vendor and Admin update access for orders" ON public.orders;
CREATE POLICY "Vendor and Admin update access for orders" ON public.orders FOR UPDATE TO authenticated
USING ((auth.jwt() ->> 'role') IN ('admin', 'owner', 'vendor'))
WITH CHECK ((auth.jwt() ->> 'role') IN ('admin', 'owner', 'vendor'));

-- POLICIES FOR ORDER_ITEMS TABLE
DROP POLICY IF EXISTS "Authenticated read access for order items" ON public.order_items;
CREATE POLICY "Authenticated read access for order items" ON public.order_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated insert access for order items" ON public.order_items;
CREATE POLICY "Authenticated insert access for order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);

-- POLICIES FOR MENU_CATEGORIES TABLE
DROP POLICY IF EXISTS "Public read access for menu categories" ON public.menu_categories;
CREATE POLICY "Public read access for menu categories" ON public.menu_categories FOR SELECT TO public
USING (is_active = true OR (auth.jwt() ->> 'role') IN ('admin', 'owner', 'vendor'));

DROP POLICY IF EXISTS "Vendor and Admin manage access for menu categories" ON public.menu_categories;
CREATE POLICY "Vendor and Admin manage access for menu categories" ON public.menu_categories FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'role') = 'admin' OR 
  ((auth.jwt() ->> 'role') IN ('owner', 'vendor') AND (auth.jwt() ->> 'shopId') = stall_id)
);

-- POLICIES FOR ORDER_STATUS_HISTORY TABLE
DROP POLICY IF EXISTS "Authenticated read order status history" ON public.order_status_history;
CREATE POLICY "Authenticated read order status history" ON public.order_status_history FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'role') IN ('admin', 'owner', 'vendor') OR
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_status_history.order_id 
      AND (orders.customer_id = (select auth.uid())::text OR orders.customer_id = (auth.jwt() ->> 'email') OR orders.customerId = (auth.jwt() ->> 'email'))
  )
);

-- POLICIES FOR AUDIT_LOGS TABLE
DROP POLICY IF EXISTS "Admin read audit logs" ON public.audit_logs;
CREATE POLICY "Admin read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Service role insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- POLICIES FOR NOTIFICATIONS TABLE
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated
USING (user_id = (select auth.uid())::text OR user_id = (auth.jwt() ->> 'email') OR (auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = (select auth.uid())::text OR user_id = (auth.jwt() ->> 'email'))
WITH CHECK (user_id = (select auth.uid())::text OR user_id = (auth.jwt() ->> 'email'));

-- POLICIES FOR SYSTEM_SETTINGS TABLE
DROP POLICY IF EXISTS "Public read system settings" ON public.system_settings;
CREATE POLICY "Public read system settings" ON public.system_settings FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admin write system settings" ON public.system_settings;
CREATE POLICY "Admin write system settings" ON public.system_settings FOR ALL TO authenticated USING ((auth.jwt() ->> 'role') = 'admin');


-- STEP 7: IDEMPOTENT REALTIME REPLICATION ENABLEMENT
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
