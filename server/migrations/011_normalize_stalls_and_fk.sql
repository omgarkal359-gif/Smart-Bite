-- =============================================================================
-- MIGRATION 011: NORMALIZE STALLS OPERATIONAL SCHEMA
-- =============================================================================

ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.stall_categories(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS busy_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS wait_time_minutes INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS operating_hours TEXT DEFAULT '08:00 AM - 08:00 PM';
ALTER TABLE IF EXISTS public.stalls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.is_vendor_of_stall(p_stall_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;
  
  -- Direct claim check
  IF (auth.jwt() ->> 'shopId') = p_stall_id THEN
    RETURN TRUE;
  END IF;

  -- Relational lookup check
  RETURN EXISTS (
    SELECT 1 FROM public.stalls s
    JOIN public.vendors v ON s.vendor_id = v.id
    WHERE s.id = p_stall_id AND v.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
