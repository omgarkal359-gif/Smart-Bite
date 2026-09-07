-- =============================================================================
-- MIGRATION 009: VENDORS & ISOLATED PAYOUT ACCOUNTS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  business_name TEXT NOT NULL,
  owner_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  vendor_status TEXT DEFAULT 'ACTIVE' CHECK (vendor_status IN ('PENDING', 'ACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vendor_payout_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  account_holder_name TEXT,
  bank_name TEXT,
  account_number_encrypted TEXT,
  ifsc_code TEXT,
  upi_id TEXT,
  is_primary BOOLEAN DEFAULT TRUE,
  verification_status TEXT DEFAULT 'VERIFIED' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.is_vendor_owner(p_vendor_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.vendors
    WHERE id = p_vendor_id AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
