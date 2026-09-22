-- =============================================================================
-- SMARTBITE — MENU ITEM AVAILABILITY REALTIME SYNC & RLS FIX
-- =============================================================================

BEGIN;

-- 1. FIX READ RLS POLICY (Allow reading out-of-stock items for catalog rendering)
DROP POLICY IF EXISTS p_menu_read ON public.menu_items;
CREATE POLICY p_menu_read ON public.menu_items 
  FOR SELECT TO anon, authenticated 
  USING (true);

-- 2. OPERATIONAL AVAILABILITY TOGGLE RPC (Safe execution without bypassing structural admin approval)
CREATE OR REPLACE FUNCTION public.toggle_menu_item_availability(
  p_item_id INT,
  p_is_available BOOLEAN
) RETURNS JSONB AS $$
DECLARE
  v_stall_id TEXT;
  v_updated_item RECORD;
BEGIN
  SELECT stall_id INTO v_stall_id FROM public.menu_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND: Menu item #% does not exist.', p_item_id;
  END IF;

  IF NOT public.owns_stall(v_stall_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: User does not own stall %.', v_stall_id;
  END IF;

  UPDATE public.menu_items 
  SET is_available = p_is_available, updated_at = NOW()
  WHERE id = p_item_id
  RETURNING * INTO v_updated_item;

  -- Insert Audit Log
  INSERT INTO public.audit_logs (actor_id, action, resource_type, resource_id, severity, metadata)
  VALUES (
    COALESCE(auth.uid()::text, 'system'),
    'MENU_ITEM_AVAILABILITY_CHANGED',
    'menu_items',
    p_item_id::text,
    'INFO',
    jsonb_build_object('is_available', p_is_available, 'stall_id', v_stall_id)
  );

  RETURN to_jsonb(v_updated_item);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMIT;
