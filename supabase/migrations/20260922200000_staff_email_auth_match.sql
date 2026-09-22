-- =============================================================================
-- Staff Google sign-in: match RLS by verified email (not just auth.uid())
-- -----------------------------------------------------------------------------
-- A staff member (vendor/admin) provisioned with an email+password auth user has
-- a DIFFERENT auth.uid() than the auth user Supabase creates when they later sign
-- in with Google using the same address. RLS keyed only on `id = auth.uid()`
-- would then deny their vendor/admin actions after a Google login.
--
-- Fix: also match the accounts row by the provider-verified JWT email
-- (auth.jwt() ->> 'email'). Google OAuth emails are verified by Google, so an
-- email match is trustworthy — it means the caller controls that mailbox.
--
-- Enables: vendors/admins can log in with their gmail via Google instead of
-- email+password, and still pass owns_stall()/is_admin().
--
-- Run in the Supabase SQL Editor. Idempotent (CREATE OR REPLACE).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_allowlist
    WHERE email = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
  ) OR EXISTS (
    SELECT 1 FROM public.accounts
    WHERE role = 'admin'
      AND (id = auth.uid() OR LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
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
    WHERE role = 'vendor'
      AND shop_id = p_stall_id
      AND (id = auth.uid() OR LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;
