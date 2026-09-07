-- =============================================================================
-- Migration: 003_create_auxiliary_tables.sql
-- Description: Create production auxiliary tables:
--   1. menu_categories
--   2. order_status_history
--   3. audit_logs
--   4. notifications
--   5. system_settings
-- =============================================================================

-- 1. MENU CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS menu_categories (
  id SERIAL PRIMARY KEY,
  stall_id TEXT NOT NULL REFERENCES stalls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_stall_category_name UNIQUE(stall_id, name)
);

-- 2. ORDER STATUS HISTORY TABLE (AUDITABLE ORDER LIFECYCLE)
CREATE TABLE IF NOT EXISTS order_status_history (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT DEFAULT 'system',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. POSTGRESQL APPEND-ONLY AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
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

-- 4. USER NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SYSTEM SETTINGS TABLE
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by TEXT DEFAULT 'admin',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Initial System Settings if empty
INSERT INTO system_settings (key, value, description, updated_by)
VALUES 
  ('ordering_enabled', 'true'::jsonb, 'Global campus ordering system flag', 'system'),
  ('maintenance_mode', 'false'::jsonb, 'Platform maintenance mode flag', 'system'),
  ('platform_commission_percent', '5'::jsonb, 'Default platform commission rate percent', 'system')
ON CONFLICT (key) DO NOTHING;
