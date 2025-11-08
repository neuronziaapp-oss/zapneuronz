-- Supabase Schema Migration from SQLite
-- Run this script in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'operator' CHECK (role IN ('admin', 'operator')),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Instances table
CREATE TABLE instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL UNIQUE,
  evolution_instance_id VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50),
  status VARCHAR(50) DEFAULT 'connecting' CHECK (status IN ('connecting', 'connected', 'disconnected', 'error')),
  qr_code TEXT,
  profile_pic_url VARCHAR(500),
  webhook_url VARCHAR(500),
  settings JSONB DEFAULT '{}',
  last_seen TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contacts table
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  push_name VARCHAR(255),
  profile_pic_url VARCHAR(500),
  is_group BOOLEAN DEFAULT false,
  group_metadata JSONB,
  last_seen TIMESTAMP WITH TIME ZONE,
  is_blocked BOOLEAN DEFAULT false,
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(phone, instance_id)
);

-- Chats table
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id VARCHAR(255) NOT NULL,
  last_message JSONB,
  last_message_time TIMESTAMP WITH TIME ZONE,
  unread_count INTEGER DEFAULT 0,
  pinned BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  muted BOOLEAN DEFAULT false,
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicates
  UNIQUE(chat_id, instance_id)
);

-- Messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id VARCHAR(255) NOT NULL,
  from_me BOOLEAN NOT NULL,
  chat_id VARCHAR(255) NOT NULL,
  participant VARCHAR(255),
  message_type VARCHAR(50) NOT NULL CHECK (message_type IN (
    'text', 'image', 'video', 'audio', 'document', 
    'sticker', 'location', 'contact', 'system'
  )),
  content TEXT,
  media_url VARCHAR(500),
  media_path VARCHAR(500),
  media_size INTEGER,
  media_mime_type VARCHAR(100),
  thumbnail_path VARCHAR(500),
  timestamp_msg TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'error')),
  quoted_message_id VARCHAR(255),
  metadata JSONB DEFAULT '{}',
  instance_id UUID NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
  chat_table_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_contacts_phone_instance ON contacts(phone, instance_id);
CREATE INDEX idx_chats_chat_id_instance ON chats(chat_id, instance_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp_msg DESC);
CREATE INDEX idx_messages_instance ON messages(instance_id);
CREATE INDEX idx_instances_evolution_id ON instances(evolution_instance_id);

-- Row Level Security (RLS) - Para segurança adicional
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS simples (pode ser ajustado conforme necessário)
-- Como usaremos Service Key, essas políticas são mais para documentação
CREATE POLICY "Allow service role full access" ON users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON instances FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON contacts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON chats FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON messages FOR ALL USING (auth.role() = 'service_role');

-- Functions para updated_at automatico
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_instances_updated_at 
  BEFORE UPDATE ON instances 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at 
  BEFORE UPDATE ON contacts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at 
  BEFORE UPDATE ON chats 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at 
  BEFORE UPDATE ON messages 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();