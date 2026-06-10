-- Migration to add payment proof columns to the orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
ADD COLUMN IF NOT EXISTS payment_proof_file_name TEXT,
ADD COLUMN IF NOT EXISTS payment_proof_uploaded_at TIMESTAMPTZ;