-- =============================================================================
-- audit_logs: real server-side audit trail (replaces localStorage fake logs)
-- -----------------------------------------------------------------------------
-- Append-only. Written ONLY through the SECURITY DEFINER log_event() RPC, which
-- stamps the actor from the caller's session (clients cannot forge the actor or
-- read the table). Admin-only read. Realtime-enabled for the admin log view.
--
-- Run in the Supabase SQL Editor AFTER platform_config. Idempotent.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id    UUID,
  actor_email TEXT,
  category    TEXT NOT NULL DEFAULT 'System',
  level       TEXT NOT NULL DEFAULT 'INFO',
  message     TEXT NOT NULL,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Read: admins only. Writes go through log_event() (SECURITY DEFINER, bypasses
-- RLS); there is deliberately no INSERT policy so clients can't forge rows.
DROP POLICY IF EXISTS p_audit_read ON public.audit_logs;
CREATE POLICY p_audit_read ON public.audit_logs
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS p_audit_delete ON public.audit_logs;
CREATE POLICY p_audit_delete ON public.audit_logs
  FOR DELETE TO authenticated USING (public.is_admin());

-- Append an audit entry; actor is taken from the session, never the client.
CREATE OR REPLACE FUNCTION public.log_event(
  p_category text,
  p_level    text,
  p_message  text,
  p_meta     jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_message IS NULL OR btrim(p_message) = '' THEN RETURN; END IF;
  INSERT INTO public.audit_logs (actor_id, actor_email, category, level, message, meta)
  VALUES (
    auth.uid(),
    lower(coalesce(auth.jwt() ->> 'email', '')),
    coalesce(nullif(p_category, ''), 'System'),
    coalesce(nullif(p_level, ''), 'INFO'),
    p_message,
    coalesce(p_meta, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_event(text, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.log_event(text, text, text, jsonb) TO authenticated;

-- Realtime for the admin log view.
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
