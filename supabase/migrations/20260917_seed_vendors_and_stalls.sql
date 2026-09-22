-- =============================================================================
-- Migration: Seed Narayana Stall, Vendor, and Account
-- Only contains Narayana vendor credentials & stall data
-- =============================================================================

INSERT INTO public.stalls (id, name, category, rating, is_active, is_online, busy_mode, wait_time_minutes)
VALUES
  ('narayana', 'Narayana', 'South Indian Special', 4.5, true, true, false, 0)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category;

INSERT INTO public.vendors (stall_id, business_name, contact_email, vendor_status)
VALUES
  ('narayana', 'Narayana', 'narayana2026@gmail.com', 'ACTIVE')
ON CONFLICT (stall_id) DO UPDATE SET
  contact_email = EXCLUDED.contact_email,
  business_name = EXCLUDED.business_name,
  vendor_status = EXCLUDED.vendor_status;

-- NOTE: the vendor's login (auth.users + accounts rows) is provisioned by the
-- provision-vendor Edge Function, NOT seeded here. A public.accounts row cannot
-- exist without a matching auth.users id (accounts.id references auth.users).
