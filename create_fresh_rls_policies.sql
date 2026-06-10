-- Clean script to create fresh RLS policies for documents bucket
-- After all existing policies have been deleted

-- 1. Verify documents bucket exists and is public
DO $$
DECLARE
  bucket_exists BOOLEAN;
  is_public BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'documents') INTO bucket_exists;

  IF NOT bucket_exists THEN
    RAISE EXCEPTION '❌ Documents bucket does not exist. Please create it first.';
  END IF;

  SELECT public INTO is_public
  FROM storage.buckets
  WHERE id = 'documents';

  IF NOT is_public THEN
    UPDATE storage.buckets SET public = true WHERE id = 'documents';
    RAISE NOTICE 'Made documents bucket public';
  ELSE
    RAISE NOTICE '✅ Documents bucket exists and is public';
  END IF;
END $$;

-- 2. Create fresh RLS policies with proper authentication
DO $$
BEGIN
  -- Policy for authenticated users to upload to documents bucket
  CREATE POLICY "documents_upload_policy"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND  -- Require authenticated user
    bucket_id = 'documents'
  );

  -- Policy for authenticated users to read from documents bucket
  CREATE POLICY "documents_read_policy"
  ON storage.objects
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND  -- Require authenticated user
    bucket_id = 'documents'
  );

  RAISE NOTICE '✅ Created fresh RLS policies for documents bucket with proper authentication';
END $$;

-- 3. Verify policies were created
SELECT * FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
AND (policyname = 'documents_upload_policy' OR policyname = 'documents_read_policy');