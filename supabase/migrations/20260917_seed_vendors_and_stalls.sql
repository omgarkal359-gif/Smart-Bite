-- =============================================================================
-- Migration: Seed Narayana Stall, Vendor, and Account
-- Only contains Narayana vendor credentials & stall data
-- =============================================================================

INSERT INTO public.stalls (id, name, category, rating, is_active, is_online, busy_mode, wait_time_minutes)
VALUES
  ('narayana', 'Narayana', 'South Indian Special', 4.5, true, true, false, 0)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category;

INSERT INTO public.vendors (stall_id, business_name, contact_email, vendor_status, details)
VALUES
  ('narayana', 'Narayana', 'narayana2026@gmail.com', 'ACTIVE', '{"email": "narayana2026@gmail.com", "system_password": "narayana2026"}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO public.accounts (email, full_name, role, shop_id)
VALUES
  ('narayana2026@gmail.com', 'Narayana Vendor', 'vendor', 'narayana')
ON CONFLICT DO NOTHING;
