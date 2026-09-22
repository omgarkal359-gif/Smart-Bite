-- =============================================================================
-- Staff Google sign-in: match RLS by VERIFIED email (not just auth.uid())
-- -----------------------------------------------------------------------------
-- A staff member (vendor/admin) provisioned with an email+password auth user has
-- a DIFFERENT auth.uid() than the auth user Supabase creates when they later sign
-- in with Google using the same address. RLS keyed only on `id = auth.uid()`
-- would then deny their vendor/admin actions after a Google login.
--
-- Fix: also match the accounts row by the caller's email — BUT only when that
-- email is actually verified. We never trust the raw `auth.jwt() ->> 'email'`
-- claim (an unconfirmed email+password signup could carry an arbitrary email and
-- impersonate a vendor/admin). Instead we read the caller's CONFIRMED email from
-- auth.users (email_confirmed_at IS NOT NULL). Google OAuth logins and confirmed
-- password accounts both have email_confirmed_at set; an unverified signup does
-- not, so it matches nothing.
--
-- Run in the Supabase SQL Editor. Idempotent (CREATE OR REPLACE).
-- =============================================================================

-- Caller's verified email, or NULL if the current user's email is unconfirmed.
-- SECURITY DEFINER so it can read auth.users; STABLE; never trusts a raw claim.
CREATE OR REPLACE FUNCTION public.caller_verified_email()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT LOWER(u.email)
  FROM auth.users u
  WHERE u.id = auth.uid()
    AND u.email_confirmed_at IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.caller_verified_email() FROM public;
GRANT EXECUTE ON FUNCTION public.caller_verified_email() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  v_email text := public.caller_verified_email();
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_allowlist
    WHERE v_email IS NOT NULL AND email = v_email
  ) OR EXISTS (
    SELECT 1 FROM public.accounts
    WHERE role = 'admin'
      AND (id = auth.uid() OR (v_email IS NOT NULL AND LOWER(email) = v_email))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;

CREATE OR REPLACE FUNCTION public.owns_stall(p_stall_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_email text := public.caller_verified_email();
BEGIN
  IF p_stall_id IS NULL OR TRIM(p_stall_id) = '' THEN RETURN FALSE; END IF;
  IF public.is_admin() THEN RETURN TRUE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.accounts
    WHERE role = 'vendor'
      AND shop_id = p_stall_id
      AND (id = auth.uid() OR (v_email IS NOT NULL AND LOWER(email) = v_email))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE;
