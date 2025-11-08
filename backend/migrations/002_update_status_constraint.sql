-- Add more status values to instances table check constraint
-- Run this in Supabase SQL Editor after the initial schema

ALTER TABLE instances DROP CONSTRAINT instances_status_check;

ALTER TABLE instances ADD CONSTRAINT instances_status_check 
CHECK (status IN ('connecting', 'connected', 'disconnected', 'error', 'qr_code', 'pairing'));

-- Optional: Add missing columns if needed in future
-- ALTER TABLE instances ADD COLUMN IF NOT EXISTS qr_code_base64 TEXT;
-- ALTER TABLE instances ADD COLUMN IF NOT EXISTS profile_name VARCHAR(255);