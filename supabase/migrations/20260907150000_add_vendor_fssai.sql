-- Add FSSAI license number to vendors (shown on receipts). Run once in SQL Editor.
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS fssai TEXT;
