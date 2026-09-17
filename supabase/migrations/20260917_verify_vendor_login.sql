-- =============================================================================
-- Migration: Create verify_vendor_login RPC Function
-- Fixes 404 (Not Found) error when logging in as a vendor.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.verify_vendor_login(p_input TEXT, p_password TEXT)
RETURNS JSONB AS $$
DECLARE
  v_input TEXT := LOWER(TRIM(COALESCE(p_input, '')));
  v_pwd TEXT := TRIM(COALESCE(p_password, ''));
  v_rec RECORD;
  v_details JSONB;
  v_sys_pwd TEXT;
  v_stall_id TEXT;
  v_email TEXT;
  v_name TEXT;
BEGIN
  IF v_input = '' OR v_pwd = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Email/Username and Password are required.');
  END IF;

  -- 1. Search vendors table by stall_id, contact_email, or details
  FOR v_rec IN 
    SELECT * FROM public.vendors 
    WHERE LOWER(COALESCE(stall_id, '')) = v_input 
       OR LOWER(COALESCE(contact_email, '')) = v_input 
       OR LOWER(COALESCE(details->>'email', '')) = v_input 
       OR LOWER(COALESCE(details->>'contact_email', '')) = v_input 
       OR LOWER(COALESCE(business_name, '')) = v_input
  LOOP
    v_details := COALESCE(v_rec.details, '{}'::jsonb);
    v_sys_pwd := TRIM(COALESCE(v_details->>'system_password', v_details->>'password', ''));
    
    IF v_sys_pwd <> '' AND v_sys_pwd = v_pwd THEN
      v_stall_id := COALESCE(v_rec.stall_id, v_rec.id::text);
      v_email := COALESCE(v_rec.contact_email, v_details->>'email', v_input);
      v_name := COALESCE(v_rec.business_name, v_stall_id);
      
      RETURN jsonb_build_object(
        'success', true,
        'token', 'vendor-session-' || v_stall_id,
        'user', jsonb_build_object(
          'id', v_stall_id,
          'username', v_email,
          'name', v_name,
          'role', 'vendor',
          'shopId', v_stall_id
        )
      );
    END IF;
  END LOOP;

  -- 2. Search accounts table linked to vendors
  FOR v_rec IN 
    SELECT a.*, v.details, v.business_name, v.contact_email 
    FROM public.accounts a 
    LEFT JOIN public.vendors v ON LOWER(v.stall_id) = LOWER(a.shop_id)
    WHERE LOWER(COALESCE(a.email, '')) = v_input OR LOWER(COALESCE(a.shop_id, '')) = v_input
  LOOP
    v_details := COALESCE(v_rec.details, '{}'::jsonb);
    v_sys_pwd := TRIM(COALESCE(v_details->>'system_password', v_details->>'password', ''));
    v_stall_id := COALESCE(v_rec.shop_id, v_input);
    
    IF v_sys_pwd <> '' AND v_sys_pwd = v_pwd THEN
      RETURN jsonb_build_object(
        'success', true,
        'token', 'vendor-session-' || v_stall_id,
        'user', jsonb_build_object(
          'id', v_stall_id,
          'username', COALESCE(v_rec.email, v_input),
          'name', COALESCE(v_rec.business_name, v_rec.full_name, v_stall_id),
          'role', 'vendor',
          'shopId', v_stall_id
        )
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', false, 'message', 'Invalid credentials. Please check your vendor email/username and password.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.verify_vendor_login(TEXT, TEXT) TO anon, authenticated, service_role;
