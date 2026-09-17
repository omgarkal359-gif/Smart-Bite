-- =============================================================================
-- Migration: Seed Stalls, Vendors, and Vendor Accounts
-- Populates public.stalls, public.vendors, and public.accounts with default stalls
-- =============================================================================

INSERT INTO public.stalls (id, name, category, rating, is_active, is_online, busy_mode, wait_time_minutes)
VALUES
  ('narayana', 'Narayana', 'South Indian Special', 4.5, true, true, false, 0),
  ('mangales-snacks', 'Southern Delight (Mangale Snacks)', 'Snacks & Thalipeeth', 4.6, true, true, false, 0),
  ('baskin-robbins', 'Baskin Robbins', 'Desserts & Ice Cream', 4.8, true, true, false, 0),
  ('amul', 'Amul Ice Cream & Shakes', 'Dairy & Shakes', 4.7, true, true, false, 0),
  ('chat-chaska', 'Chat Chaska', 'Street Food & Chaat', 4.4, true, true, false, 0),
  ('nescafe', 'Nescafe', 'Beverages & Coffee', 4.5, true, true, false, 0)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category;

INSERT INTO public.vendors (stall_id, business_name, contact_email, vendor_status, details)
VALUES
  ('narayana', 'Narayana', 'narayana2026@gmail.com', 'ACTIVE', '{"email": "narayana2026@gmail.com", "system_password": "narayana2026"}'::jsonb),
  ('mangales-snacks', 'Southern Delight', 'mangale@sgu.ac.in', 'ACTIVE', '{"email": "mangale@sgu.ac.in", "system_password": "mangale2026"}'::jsonb),
  ('baskin-robbins', 'Baskin Robbins', 'baskin@sgu.ac.in', 'ACTIVE', '{"email": "baskin@sgu.ac.in", "system_password": "baskin2026"}'::jsonb),
  ('amul', 'Amul Ice Cream & Shakes', 'amul@sgu.ac.in', 'ACTIVE', '{"email": "amul@sgu.ac.in", "system_password": "amul2026"}'::jsonb),
  ('chat-chaska', 'Chat Chaska', 'chatchaska@sgu.ac.in', 'ACTIVE', '{"email": "chatchaska@sgu.ac.in", "system_password": "chatchaska2026"}'::jsonb),
  ('nescafe', 'Nescafe', 'nescafe@sgu.ac.in', 'ACTIVE', '{"email": "nescafe@sgu.ac.in", "system_password": "nescafe2026"}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO public.accounts (email, full_name, role, shop_id)
VALUES
  ('narayana2026@gmail.com', 'Narayana Vendor', 'vendor', 'narayana'),
  ('mangale@sgu.ac.in', 'Mangale Vendor', 'vendor', 'mangales-snacks'),
  ('baskin@sgu.ac.in', 'Baskin Vendor', 'vendor', 'baskin-robbins'),
  ('amul@sgu.ac.in', 'Amul Vendor', 'vendor', 'amul'),
  ('chatchaska@sgu.ac.in', 'Chat Chaska Vendor', 'vendor', 'chat-chaska'),
  ('nescafe@sgu.ac.in', 'Nescafe Vendor', 'vendor', 'nescafe')
ON CONFLICT DO NOTHING;
