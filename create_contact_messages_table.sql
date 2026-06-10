-- Create contact_messages table for storing customer inquiries
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_read BOOLEAN DEFAULT FALSE,
  responded_at TIMESTAMPTZ,
  response TEXT
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_contact_messages_is_read ON contact_messages(is_read);

-- Set up Row Level Security (RLS) policies
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Policy for admins to view all messages
CREATE POLICY "Admins can view all contact messages"
ON contact_messages FOR SELECT
USING (auth.role() = 'admin');

-- Policy for admins to update messages (mark as read, add response)
CREATE POLICY "Admins can update contact messages"
ON contact_messages FOR UPDATE
WITH CHECK (auth.role() = 'admin');

-- Policy for public insert (anyone can submit a contact form)
CREATE POLICY "Public can insert contact messages"
ON contact_messages FOR INSERT
WITH CHECK (true);

-- Grant permissions
ALTER TABLE contact_messages OWNER TO postgres;