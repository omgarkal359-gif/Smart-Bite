-- =============================================================================
-- VENDOR ONBOARDING INVITES
-- Admin creates an invite (choosing which fields to collect) -> vendor fills a
-- public onboarding form -> admin approves -> server provisions the account.
-- Table is admin-only via RLS; the public onboarding page talks to the SERVER
-- (service-role key), never to this table directly.
-- Run once in SQL Editor.
-- =============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token           UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  contact_email   TEXT NOT NULL,
  invitee_name    TEXT,
  required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,  -- field keys the admin chose to collect
  submitted_data  JSONB,                                -- the vendor's submitted answers
  status          TEXT NOT NULL DEFAULT 'sent'
                    CHECK (status IN ('sent','submitted','approved','rejected')),
  stall_id        TEXT,                                 -- assigned on approval
  reject_reason   TEXT,
  created_by      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_invites_token  ON public.vendor_invites(token);
CREATE INDEX IF NOT EXISTS idx_vendor_invites_status ON public.vendor_invites(status, created_at DESC);

ALTER TABLE public.vendor_invites ENABLE ROW LEVEL SECURITY;

-- Admin-only. (The server uses the service_role key, which bypasses RLS, to serve
-- the public token-based onboarding flow.)
DROP POLICY IF EXISTS p_invites_admin ON public.vendor_invites;
CREATE POLICY p_invites_admin ON public.vendor_invites FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

COMMIT;
