-- Secure, Cashfree-ready payout storage on vendors.
-- Raw account number is NEVER stored plaintext: only an encrypted blob + last4.
-- Run once in SQL Editor.
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS account_holder      TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS account_number_enc  TEXT;   -- AES-256-GCM encrypted
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS account_last4       TEXT;   -- for display only
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS ifsc                TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS upi_id              TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS cashfree_vendor_id  TEXT;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS payout_status       TEXT DEFAULT 'pending'
  CHECK (payout_status IN ('pending','registered','failed'));

-- Encrypted blob must never be exposed via the anon/authenticated REST role.
-- (RLS already restricts vendors writes to admin; add a column-safe read view later
--  if vendors need to see their own masked payout info.)
