-- =============================================================================
-- admin_allowlist: let a signed-in user read ONLY their own row
-- -----------------------------------------------------------------------------
-- The client resolves admin status by reading admin_allowlist for the logged-in
-- email (see checkAdminAccess / LoginPage). The existing p_allowlist_admin policy
-- (USING is_admin()) already lets real admins read the table, but this explicit
-- self-read policy removes any reliance on is_admin() reentrancy and is strictly
-- scoped: a user can see their own allowlist row and nothing else. Combined with
-- removing the hard-coded admin email fallback in the frontend, admin identity is
-- now defined entirely in the database.
--
-- Depends on caller_verified_email() (migration 20260922200000). Idempotent.
-- Run in the Supabase SQL Editor.
-- =============================================================================

DROP POLICY IF EXISTS p_allowlist_self_read ON public.admin_allowlist;
CREATE POLICY p_allowlist_self_read ON public.admin_allowlist
  FOR SELECT TO authenticated
  USING (email = public.caller_verified_email());
