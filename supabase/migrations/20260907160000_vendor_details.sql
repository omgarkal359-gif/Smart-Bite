-- Store the rest of a vendor's onboarding details (mobile, bank, PAN/GSTIN, address)
-- as JSON so the set of fields stays flexible. FSSAI keeps its own column.
-- Run once in SQL Editor.
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
