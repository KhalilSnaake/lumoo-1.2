-- Fix RLS policies for contact_messages table to allow admin access
-- This script ensures admins can read, update, and delete contact messages

-- First, check if the table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'contact_messages';

-- Update RLS policies to ensure proper admin access
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Remove any existing restrictive policies
DROP POLICY IF EXISTS "Public read contact_messages" ON contact_messages;
DROP POLICY IF EXISTS "Public insert contact_messages" ON contact_messages;
DROP POLICY IF EXISTS "Admin update contact_messages" ON contact_messages;
DROP POLICY IF EXISTS "Allow authenticated users to read their own messages" ON contact_messages;

-- Create new policies with proper admin access
CREATE POLICY "Allow public insert for contact form submissions"
ON contact_messages FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow admin full access to contact messages"
ON contact_messages FOR ALL
USING (auth.role() = 'admin');

-- Simple policy for all authenticated users to read messages (for admin panel)
CREATE POLICY "Allow all authenticated users to read messages"
ON contact_messages FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Grant permissions
ALTER TABLE contact_messages OWNER TO postgres;

-- Test query to verify messages can be retrieved
SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 10;
