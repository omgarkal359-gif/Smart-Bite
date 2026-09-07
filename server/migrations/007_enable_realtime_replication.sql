-- =============================================================================
-- Migration: 007_enable_realtime_replication.sql
-- Description: Idempotently enables Supabase Realtime replication for:
--   1. orders
--   2. order_status_history
--   3. notifications
--   4. audit_logs
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- 1. orders table
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_publication p ON pr.prpubid = p.oid
      WHERE p.pubname = 'supabase_realtime' AND c.relname = 'orders'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;

    -- 2. order_status_history table
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_publication p ON pr.prpubid = p.oid
      WHERE p.pubname = 'supabase_realtime' AND c.relname = 'order_status_history'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history;
    END IF;

    -- 3. notifications table
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_publication p ON pr.prpubid = p.oid
      WHERE p.pubname = 'supabase_realtime' AND c.relname = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;

    -- 4. audit_logs table
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_rel pr
      JOIN pg_class c ON pr.prrelid = c.oid
      JOIN pg_publication p ON pr.prpubid = p.oid
      WHERE p.pubname = 'supabase_realtime' AND c.relname = 'audit_logs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
    END IF;
  END IF;
END $$;
