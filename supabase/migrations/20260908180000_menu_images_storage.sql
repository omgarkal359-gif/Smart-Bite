-- Vendor-uploaded menu item images. Run once in the Supabase SQL Editor.
-- Creates a public "menu-images" Storage bucket and RLS policies so any
-- signed-in vendor can upload/replace/remove images, and anyone can view them.

-- Ensure menu_items has an img column (Storage public URL string).
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS img TEXT;

-- 1. Create the public bucket (idempotent).
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Policies on storage.objects scoped to this bucket.
--    Drop-if-exists first so this migration is safe to re-run.
DROP POLICY IF EXISTS "menu-images public read"        ON storage.objects;
DROP POLICY IF EXISTS "menu-images authenticated write" ON storage.objects;
DROP POLICY IF EXISTS "menu-images authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "menu-images authenticated delete" ON storage.objects;

-- Anyone (including anon students) can read menu images.
CREATE POLICY "menu-images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

-- Signed-in users (vendors) can upload.
CREATE POLICY "menu-images authenticated write"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'menu-images');

-- Signed-in users can replace their uploads.
CREATE POLICY "menu-images authenticated update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'menu-images');

-- Signed-in users can delete uploads.
CREATE POLICY "menu-images authenticated delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'menu-images');
