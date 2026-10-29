-- Fix RLS policies for contact_messages table to allow admin access
-- This script ensures admins can read, update, and delete contact messages

-- First, check if the table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'contact_messages';

-- Update RLS policies to ensure proper admin access
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Remove any existing policies
DROP POLICY IF EXISTS "Public read contact_messages" ON contact_messages;
DROP POLICY IF EXISTS "Public insert contact_messages" ON contact_messages;
DROP POLICY IF EXISTS "Admin update contact_messages" ON contact_messages;
DROP POLICY IF EXISTS "Allow authenticated users to read their own messages" ON contact_messages;
DROP POLICY IF EXISTS "Allow admin full access to contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Allow all authenticated users to read messages" ON contact_messages;
DROP POLICY IF EXISTS "Admins can view all contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Admins can update contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Public can insert contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Allow public insert for contact form submissions" ON contact_messages;

-- Create secure policies: anyone can send a message, only admins can view and manage
CREATE POLICY "Allow public insert for contact form submissions"
ON contact_messages FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow admin select contact messages"
ON contact_messages FOR SELECT
USING (public.is_admin());

CREATE POLICY "Allow admin update contact messages"
ON contact_messages FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "Allow admin delete contact messages"
ON contact_messages FOR DELETE
USING (public.is_admin());

-- Grant permissions
ALTER TABLE contact_messages OWNER TO postgres;

-- Test query to verify messages can be retrieved
SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 10;
