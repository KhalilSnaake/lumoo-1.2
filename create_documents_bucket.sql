-- Create a new bucket for documents that allows PDF uploads
-- This SQL script needs to be run in the Supabase SQL Editor

-- 1. Create the documents bucket if it doesn't exist
CREATE OR REPLACE FUNCTION create_documents_bucket()
RETURNS VOID AS $$
BEGIN
  PERFORM storage.create_bucket('documents');
  RAISE NOTICE 'Documents bucket created successfully';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Documents bucket may already exist or creation failed: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- 2. Execute the function to create the bucket
SELECT create_documents_bucket();

-- 3. Drop the function as it's no longer needed
DROP FUNCTION IF EXISTS create_documents_bucket();

-- 4. Update the documents bucket settings
UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = '{"image/jpeg","image/png","image/jpg","image/gif","application/pdf"}'
WHERE id = 'documents';

-- 5. Create more permissive RLS policies for the documents bucket
DO $$
BEGIN
  -- Remove any existing restrictive policies first
  PERFORM pg_catalog.drop_policy_if_exists('storage', 'objects', 'Allow authenticated upload to documents bucket');
  PERFORM pg_catalog.drop_policy_if_exists('storage', 'objects', 'Allow public read from documents bucket');

  -- Create more permissive upload policy
  CREATE POLICY "Allow authenticated upload to documents bucket" ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'documents');

  -- Create public read policy
  CREATE POLICY "Allow public read from documents bucket" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'documents');

  -- Create policy for updates (in case needed)
  CREATE POLICY "Allow authenticated update to documents bucket" ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'documents');

  -- Create policy for deletes (in case needed)
  CREATE POLICY "Allow authenticated delete to documents bucket" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'documents');

  RAISE NOTICE 'Created comprehensive RLS policies for documents bucket';
END $$;
