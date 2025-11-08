-- Migration: Track the active chat window per user
-- Run this script in your Supabase SQL Editor after previous migrations

-- Table to store which chat window is currently active for each user
DROP TABLE IF EXISTS active_chat_windows CASCADE;

CREATE TABLE active_chat_windows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  chat_uuid UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  chat_remote_id VARCHAR(255) NOT NULL,
  client_id VARCHAR(255),
  last_activated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure we only keep one row per user per instância
CREATE UNIQUE INDEX idx_active_chat_windows_user_instance 
  ON active_chat_windows(user_id, instance_id);

-- Helpful indexes for lookup by chat, client and remote id
CREATE INDEX idx_active_chat_windows_chat_uuid ON active_chat_windows(chat_uuid);
CREATE INDEX idx_active_chat_windows_chat_remote ON active_chat_windows(chat_remote_id);
CREATE INDEX idx_active_chat_windows_client_instance ON active_chat_windows(client_id, instance_id);

-- Keep track of activation changes separately from the generic updated_at trigger
CREATE OR REPLACE FUNCTION update_active_chat_window_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_last_activated_at_before_insert
BEFORE INSERT ON active_chat_windows
FOR EACH ROW EXECUTE FUNCTION update_active_chat_window_timestamp();

CREATE TRIGGER touch_last_activated_at_before_update
BEFORE UPDATE ON active_chat_windows
FOR EACH ROW EXECUTE FUNCTION update_active_chat_window_timestamp();

-- Reuse the global updated_at trigger helper for consistency
CREATE TRIGGER update_active_chat_windows_updated_at
  BEFORE UPDATE ON active_chat_windows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS for security parity with other tables
ALTER TABLE active_chat_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access"
  ON active_chat_windows FOR ALL
  USING (auth.role() = 'service_role');
