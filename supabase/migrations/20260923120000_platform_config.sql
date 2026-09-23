-- =============================================================================
-- platform_config: real, admin-controlled feature flags / kill-switches
-- -----------------------------------------------------------------------------
-- Single-row config the whole app reads. Replaces the ConfigEmergency module's
-- local-useState-only toggles (which did nothing). Enforced in api.createOrder
-- (pause_orders / allow_cash / allow_online) and surfaced to the app.
--
-- Run in the Supabase SQL Editor. Idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_config (
  id               INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  pause_orders     BOOLEAN NOT NULL DEFAULT FALSE,
  allow_cash       BOOLEAN NOT NULL DEFAULT TRUE,
  allow_online     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Ensure the single config row exists.
INSERT INTO public.platform_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- Everyone may READ the flags (the app checks them, incl. before login for a
-- maintenance banner). Only admins may change them.
DROP POLICY IF EXISTS p_config_read ON public.platform_config;
CREATE POLICY p_config_read ON public.platform_config
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS p_config_update ON public.platform_config;
CREATE POLICY p_config_update ON public.platform_config
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
