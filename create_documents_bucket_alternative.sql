-- Alternative approach: Modify existing images bucket to allow PDFs
-- This might be simpler than creating a new bucket

-- 1. Update the images bucket to allow PDF uploads
UPDATE storage.buckets
SET
  allowed_mime_types = '{"image/jpeg","image/png","image/jpg","image/gif","application/pdf"}'
WHERE id = 'images';

-- 2. Create permissive RLS policies for the images bucket if they don't exist
DO $$
BEGIN
  -- Remove any existing restrictive policies first
  PERFORM pg_catalog.drop_policy_if_exists('storage', 'objects', 'Allow public insert to images bucket');
  PERFORM pg_catalog.drop_policy_if_exists('storage', 'objects', 'Allow public read from images bucket');

  -- Create permissive upload policy for images bucket
  CREATE POLICY "Allow public insert to images bucket" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'images');

  -- Create public read policy for images bucket
  CREATE POLICY "Allow public read from images bucket" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'images');

  -- Create update policy for images bucket
  CREATE POLICY "Allow public update to images bucket" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'images');

  -- Create delete policy for images bucket
  CREATE POLICY "Allow public delete to images bucket" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'images');

  RAISE NOTICE 'Updated images bucket to allow PDF uploads with permissive policies';
END $$;