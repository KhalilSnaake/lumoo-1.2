-- Corrected script to fix RLS policies for documents bucket
-- Uses the correct column names for Supabase storage.objects table

-- 1. First, check if the documents bucket exists
DO $$
DECLARE
  bucket_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'documents'
  ) INTO bucket_exists;

  IF bucket_exists THEN
    RAISE NOTICE '✅ Documents bucket exists';
  ELSE
    RAISE EXCEPTION '❌ Documents bucket does not exist. Please create it first.';
  END IF;
END $$;

-- 2. Remove any existing policies that might be causing conflicts
DO $$
BEGIN
  -- Drop policies if they exist
  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated upload to documents bucket" ON storage.objects';
    RAISE NOTICE 'Dropped existing upload policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No existing upload policy to drop';
  END;

  BEGIN
    EXECUTE 'DROP POLICY IF EXISTS "Allow public read from documents bucket" ON storage.objects';
    RAISE NOTICE 'Dropped existing read policy';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No existing read policy to drop';
  END;
END $$;

-- 3. Update bucket settings to ensure proper configuration
UPDATE storage.buckets
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = '{"image/jpeg","image/png","image/jpg","image/gif","application/pdf"}'
WHERE id = 'documents';

-- 4. Create RLS policies with correct column names
DO $$
BEGIN
  -- Policy for authenticated users to upload to documents bucket
  CREATE POLICY "Allow authenticated upload to documents bucket"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    bucket_id = 'documents'
  );

  -- Policy for public read access to documents bucket
  CREATE POLICY "Allow public read from documents bucket"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents'
  );

  RAISE NOTICE '✅ Created RLS policies for documents bucket';
END $$;

-- 5. Verify the policies were created successfully
DO $$
DECLARE
  upload_policy_exists BOOLEAN;
  read_policy_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Allow authenticated upload to documents bucket'
  ) INTO upload_policy_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Allow public read from documents bucket'
  ) INTO read_policy_exists;

  IF upload_policy_exists AND read_policy_exists THEN
    RAISE NOTICE '✅ All RLS policies are in place for documents bucket';
  ELSE
    RAISE EXCEPTION '❌ Some RLS policies were not created successfully';
  END IF;
END $$;