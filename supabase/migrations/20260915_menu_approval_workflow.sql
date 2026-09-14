-- =============================================================================
-- SMARTBITE ENTERPRISE — VENDOR MENU CHANGE APPROVAL WORKFLOW MIGRATION
-- Migration: 20260915_menu_approval_workflow.sql
-- =============================================================================

BEGIN;

-- 1. MENU CHANGE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.menu_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stall_id TEXT NOT NULL REFERENCES public.stalls(id) ON DELETE CASCADE,
  vendor_user_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  menu_item_id INTEGER REFERENCES public.menu_items(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('CREATE', 'UPDATE', 'DELETE')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  proposed_data JSONB NOT NULL,
  current_data JSONB,
  version_at_submission TIMESTAMPTZ,
  rejection_reason TEXT,
  submitted_by TEXT NOT NULL,
  reviewed_by TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_menu_change_requests_stall ON public.menu_change_requests(stall_id);
CREATE INDEX IF NOT EXISTS idx_menu_change_requests_status ON public.menu_change_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_change_requests_item ON public.menu_change_requests(menu_item_id);

-- Enforce Maximum 1 Active Pending UPDATE/DELETE Request Per Menu Item
CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_request_per_item 
  ON public.menu_change_requests(menu_item_id) 
  WHERE status = 'PENDING' AND request_type IN ('UPDATE', 'DELETE');

-- 2. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.menu_change_requests ENABLE ROW LEVEL SECURITY;

-- Read Policy: Admins can view all requests; Vendors can view their own stall's requests
DROP POLICY IF EXISTS p_menu_req_read ON public.menu_change_requests;
CREATE POLICY p_menu_req_read ON public.menu_change_requests
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.owns_stall(stall_id));

-- Insert Policy: Vendors can insert PENDING requests for their stall
DROP POLICY IF EXISTS p_menu_req_insert ON public.menu_change_requests;
CREATE POLICY p_menu_req_insert ON public.menu_change_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin() OR public.owns_stall(stall_id))
    AND status = 'PENDING'
  );

-- Update Policy: ONLY Admins can UPDATE request status / add rejection reasons
DROP POLICY IF EXISTS p_menu_req_update ON public.menu_change_requests;
CREATE POLICY p_menu_req_update ON public.menu_change_requests
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. POSTGRESQL RPC FUNCTION: APPROVE REQUEST ATOMICALLY
CREATE OR REPLACE FUNCTION public.approve_menu_change_request(
  p_request_id UUID,
  p_admin_id TEXT
) RETURNS JSONB AS $$
DECLARE
  v_req RECORD;
  v_live_item RECORD;
  v_new_item_id INT;
  v_item_id INT;
BEGIN
  -- Verify Admin Authorization
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Admin authorization required.';
  END IF;

  -- Row-level lock on request row for concurrency prevention
  SELECT * INTO v_req 
  FROM public.menu_change_requests 
  WHERE id = p_request_id AND status = 'PENDING'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_PROCESSED: Request does not exist or is no longer PENDING.';
  END IF;

  -- Stale Request Prevention (For UPDATE and DELETE)
  IF v_req.request_type IN ('UPDATE', 'DELETE') THEN
    SELECT * INTO v_live_item FROM public.menu_items WHERE id = v_req.menu_item_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'ITEM_NOT_FOUND: The target menu item no longer exists.';
    END IF;

    IF v_req.version_at_submission IS NOT NULL AND v_live_item.updated_at > v_req.version_at_submission THEN
      RAISE EXCEPTION 'STALE_REQUEST_CONFLICT: Live menu item has been updated since this request was submitted.';
    END IF;
  END IF;

  -- Execute Structural Change
  IF v_req.request_type = 'CREATE' THEN
    INSERT INTO public.menu_items (
      stall_id, name, price, category, stock, is_veg, is_available, img, created_at, updated_at
    ) VALUES (
      v_req.stall_id,
      v_req.proposed_data ->> 'name',
      (v_req.proposed_data ->> 'price')::NUMERIC,
      COALESCE(v_req.proposed_data ->> 'category', 'Main'),
      COALESCE((v_req.proposed_data ->> 'stock')::INT, 20),
      COALESCE((v_req.proposed_data ->> 'is_veg')::BOOLEAN, true),
      COALESCE((v_req.proposed_data ->> 'is_available')::BOOLEAN, true),
      v_req.proposed_data ->> 'img',
      NOW(), NOW()
    ) RETURNING id INTO v_new_item_id;

    v_item_id := v_new_item_id;

  ELSIF v_req.request_type = 'UPDATE' THEN
    UPDATE public.menu_items SET
      name = COALESCE(v_req.proposed_data ->> 'name', name),
      price = COALESCE((v_req.proposed_data ->> 'price')::NUMERIC, price),
      category = COALESCE(v_req.proposed_data ->> 'category', category),
      stock = COALESCE((v_req.proposed_data ->> 'stock')::INT, stock),
      is_veg = COALESCE((v_req.proposed_data ->> 'is_veg')::BOOLEAN, is_veg),
      img = CASE WHEN v_req.proposed_data ? 'img' THEN v_req.proposed_data ->> 'img' ELSE img END,
      updated_at = NOW()
    WHERE id = v_req.menu_item_id;

    v_item_id := v_req.menu_item_id;

  ELSIF v_req.request_type = 'DELETE' THEN
    -- Soft-delete / deactivation
    UPDATE public.menu_items SET
      is_available = false,
      updated_at = NOW()
    WHERE id = v_req.menu_item_id;

    v_item_id := v_req.menu_item_id;
  END IF;

  -- Mark Request APPROVED
  UPDATE public.menu_change_requests SET
    status = 'APPROVED',
    reviewed_by = p_admin_id,
    reviewed_at = NOW(),
    menu_item_id = v_item_id,
    updated_at = NOW()
  WHERE id = p_request_id;

  -- Write Audit Log
  INSERT INTO public.audit_logs (
    actor_id, action, resource_type, resource_id, severity, status, metadata
  ) VALUES (
    p_admin_id,
    'MENU_CHANGE_REQUEST_APPROVED',
    'menu_change_requests',
    p_request_id::text,
    'INFO',
    'SUCCESS',
    jsonb_build_object(
      'stall_id', v_req.stall_id,
      'request_type', v_req.request_type,
      'menu_item_id', v_item_id
    )
  );

  RETURN jsonb_build_object('success', true, 'menu_item_id', v_item_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. POSTGRESQL RPC FUNCTION: REJECT REQUEST ATOMICALLY
CREATE OR REPLACE FUNCTION public.reject_menu_change_request(
  p_request_id UUID,
  p_admin_id TEXT,
  p_rejection_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_req RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Admin authorization required.';
  END IF;

  IF p_rejection_reason IS NULL OR TRIM(p_rejection_reason) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED: A valid rejection reason must be provided.';
  END IF;

  SELECT * INTO v_req 
  FROM public.menu_change_requests 
  WHERE id = p_request_id AND status = 'PENDING'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_ALREADY_PROCESSED: Request does not exist or is no longer PENDING.';
  END IF;

  UPDATE public.menu_change_requests SET
    status = 'REJECTED',
    rejection_reason = TRIM(p_rejection_reason),
    reviewed_by = p_admin_id,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;

  INSERT INTO public.audit_logs (
    actor_id, action, resource_type, resource_id, severity, status, metadata
  ) VALUES (
    p_admin_id,
    'MENU_CHANGE_REQUEST_REJECTED',
    'menu_change_requests',
    p_request_id::text,
    'INFO',
    'SUCCESS',
    jsonb_build_object(
      'stall_id', v_req.stall_id,
      'request_type', v_req.request_type,
      'rejection_reason', p_rejection_reason
    )
  );

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. REALTIME REPLICATION
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_change_requests;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

COMMIT;
