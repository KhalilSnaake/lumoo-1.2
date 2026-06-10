-- Test query to verify contact messages can be retrieved
-- Run this in Supabase SQL Editor to check if messages exist

SELECT * FROM contact_messages
ORDER BY created_at DESC
LIMIT 10;

-- Check table permissions
SELECT table_name, has_select_privilege
FROM information_schema.table_privileges
WHERE table_name = 'contact_messages';

-- Check RLS policies
SELECT policy_name, action, using_expression
FROM information_schema.policies
WHERE table_name = 'contact_messages';

-- Check current user role
SELECT auth.uid(), (SELECT role FROM users WHERE id::text = auth.uid()) as user_role;

-- Count total messages
SELECT COUNT(*) as total_messages FROM contact_messages;

-- Check for unread messages
SELECT COUNT(*) as unread_messages FROM contact_messages WHERE is_read = FALSE;