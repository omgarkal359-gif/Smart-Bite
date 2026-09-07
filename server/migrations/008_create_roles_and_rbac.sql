-- =============================================================================
-- MIGRATION 008: ROLES, USER_ROLES & PROFILES RBAC ARCHITECTURE
-- =============================================================================

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
