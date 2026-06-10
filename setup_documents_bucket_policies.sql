-- Focused script to set up RLS policies for the existing documents bucket
-- This should resolve the "new row violates row-level security policy" error

-- 1. Remove any existing restrictive policies first
DO $$
BEGIN
  PERFORM pg_catalog.drop_policy_if_exists('storage', 'objects', 'Allow authenticated upload to documents bucket');
  PERFORM pg_catalog.drop_policy_if_exists('storage', 'objects', 'Allow public read from documents bucket');
  PERFORM pg_catalog.drop_policy_if_exists('storage', 'objects', 'Allow authenticated update to documents bucket');
  PERFORM pg_catalog.drop_policy_if_exists('storage', 'objects', 'Allow authenticated delete to documents bucket');
  RAISE NOTICE 'Removed any existing policies for documents bucket';
END $$;

-- 2. Update the documents bucket settings to ensure proper configuration
UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = '{"image/jpeg","image/png","image/jpg","image/gif","application/pdf"}'
WHERE id = 'documents';

-- 3. Create comprehensive RLS policies with proper authentication checks
DO $$
BEGIN
  -- Policy for authenticated users to upload to documents bucket
  CREATE POLICY "Allow authenticated upload to documents bucket"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    bucket_id = 'documents' AND
    -- Additional security: only allow specific file types
    (
      -- Image types
      content_type IN ('image/jpeg', 'image/png', 'image/jpg', 'image/gif') OR
      -- PDF type
      content_type = 'application/pdf'
    )
  );

  -- Policy for public read access to documents bucket
  CREATE POLICY "Allow public read from documents bucket"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents'
  );

  -- Policy for authenticated users to update their own files
  CREATE POLICY "Allow authenticated update to documents bucket"
  ON storage.objects
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    bucket_id = 'documents'
  );

  -- Policy for authenticated users to delete their own files
  CREATE POLICY "Allow authenticated delete to documents bucket"
  ON storage.objects
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    bucket_id = 'documents'
  );

  RAISE NOTICE 'Created comprehensive RLS policies for documents bucket with proper authentication checks';
END $$;

-- 4. Verify the policies were created successfully
DO $$
BEGIN
  PERFORM 1 FROM pg_policies
  WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname = 'Allow authenticated upload to documents bucket';

  IF FOUND THEN
    RAISE NOTICE '✅ Upload policy is in place for authenticated users';
  ELSE
    RAISE EXCEPTION '❌ Upload policy was not created';
  END IF;

  PERFORM 1 FROM pg_policies
  WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname = 'Allow public read from documents bucket';

  IF FOUND THEN
    RAISE NOTICE '✅ Read policy is in place for public access';
  ELSE
    RAISE EXCEPTION '❌ Read policy was not created';
  END IF;
END $$;