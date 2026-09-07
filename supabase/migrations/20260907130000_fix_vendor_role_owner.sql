-- =============================================================================
-- FIX: the app uses role 'owner' for vendors (routes, redirectByRole, requireRole).
-- v2 migration used 'vendor'. Align the DB to 'owner'. Run once in SQL Editor.
-- =============================================================================
BEGIN;

-- 1. Allow 'owner' in the role check, migrate any existing 'vendor' rows.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
UPDATE public.profiles SET role = 'owner' WHERE role = 'vendor';
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('student', 'owner', 'admin'));

-- 2. Signup trigger: map a 'vendor'/'owner' metadata hint to the app's 'owner' role.
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
    v_role := 'owner';
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

-- 3. owns_stall(): vendor ownership check uses role 'owner'.
CREATE OR REPLACE FUNCTION public.owns_stall(p_stall_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_stall_id IS NULL OR TRIM(p_stall_id) = '' THEN RETURN FALSE; END IF;
  IF public.is_admin() THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'owner' AND shop_id = p_stall_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

COMMIT;
