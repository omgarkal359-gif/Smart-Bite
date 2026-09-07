-- =============================================================================
-- MIGRATION 015: SYSTEM GOVERNANCE, AUDIT LOGS & NOTIFICATIONS
-- =============================================================================

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
