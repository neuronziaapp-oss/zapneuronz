-- Migration: Add client_id field to users table for multi-tenancy support
-- This enables multiple clients to use the application with isolated instances
-- Run this script in your Supabase SQL Editor

-- Add client_id column to users table
ALTER TABLE users 
ADD COLUMN client_id VARCHAR(255) UNIQUE;

-- Add index for faster client_id lookups
CREATE INDEX idx_users_client_id ON users(client_id);

-- Add comment to document the column purpose
COMMENT ON COLUMN users.client_id IS 'Unique identifier for client in iframe/embedded mode. Used for multi-tenancy isolation.';

-- Update existing iframe user with a default client_id if exists
UPDATE users 
SET client_id = 'default-iframe-client'
WHERE email = 'agent-iframe@neurons.local' 
AND client_id IS NULL;

-- Optional: Create function to auto-generate client_id if needed
CREATE OR REPLACE FUNCTION generate_client_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NULL AND NEW.email LIKE '%@iframe.local' THEN
    NEW.client_id := 'client-' || LOWER(REGEXP_REPLACE(gen_random_uuid()::text, '-', '', 'g'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Optional: Create trigger to auto-generate client_id for iframe users
CREATE TRIGGER set_client_id_before_insert
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION generate_client_id();
