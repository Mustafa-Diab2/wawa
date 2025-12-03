-- WhatsApp CRM - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. WhatsApp Sessions Table
-- ============================================
CREATE TABLE whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id TEXT NOT NULL,
  qr TEXT DEFAULT '',
  is_ready BOOLEAN DEFAULT FALSE,
  should_disconnect BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_whatsapp_sessions_owner_id ON whatsapp_sessions(owner_id);

-- RLS Policies
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON whatsapp_sessions FOR SELECT
  USING (owner_id = auth.uid()::text);

CREATE POLICY "Users can insert their own sessions"
  ON whatsapp_sessions FOR INSERT
  WITH CHECK (owner_id = auth.uid()::text);

CREATE POLICY "Users can update their own sessions"
  ON whatsapp_sessions FOR UPDATE
  USING (owner_id = auth.uid()::text);

CREATE POLICY "Service role can do everything on sessions"
  ON whatsapp_sessions
  USING (auth.role() = 'service_role');

-- ============================================
-- 2. Chats Table
-- ============================================
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  remote_id TEXT NOT NULL,
  name TEXT,
  type TEXT CHECK (type IN ('INDIVIDUAL', 'GROUP')) DEFAULT 'INDIVIDUAL',
  status TEXT CHECK (status IN ('INBOX', 'DONE', 'ARCHIVED')) DEFAULT 'INBOX',
  is_unread BOOLEAN DEFAULT FALSE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  avatar TEXT,
  assigned_to TEXT,
  is_group BOOLEAN DEFAULT FALSE,
  is_read BOOLEAN DEFAULT TRUE,
  is_muted BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  mode TEXT CHECK (mode IN ('ai', 'human')) DEFAULT 'ai',
  needs_human BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(session_id, remote_id)
);

-- Indexes
CREATE INDEX idx_chats_session_id ON chats(session_id);
CREATE INDEX idx_chats_remote_id ON chats(remote_id);
CREATE INDEX idx_chats_status ON chats(status);
CREATE INDEX idx_chats_last_message_at ON chats(last_message_at DESC);

-- RLS Policies
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chats from their sessions"
  ON chats FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert chats for their sessions"
  ON chats FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can update chats from their sessions"
  ON chats FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Service role can do everything on chats"
  ON chats
  USING (auth.role() = 'service_role');

-- ============================================
-- 3. Messages Table
-- ============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES whatsapp_sessions(id) ON DELETE CASCADE,
  remote_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  body TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  is_from_us BOOLEAN DEFAULT FALSE,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'audio', 'document', 'sticker')),
  media_url TEXT,
  status TEXT CHECK (status IN ('sent', 'delivered', 'read', 'pending', 'failed')) DEFAULT 'pending',
  user_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_session_id ON messages(session_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_status ON messages(status);

-- RLS Policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from their sessions"
  ON messages FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can insert messages for their sessions"
  ON messages FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Users can update messages from their sessions"
  ON messages FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()::text
    )
  );

CREATE POLICY "Service role can do everything on messages"
  ON messages
  USING (auth.role() = 'service_role');

-- ============================================
-- 4. Contacts Table
-- ============================================
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  category_id UUID,
  avatar TEXT,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_phone ON contacts(phone);

-- RLS Policies
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts"
  ON contacts FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own contacts"
  ON contacts FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own contacts"
  ON contacts FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own contacts"
  ON contacts FOR DELETE
  USING (user_id = auth.uid()::text);

-- ============================================
-- 5. Categories Table
-- ============================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- RLS Policies
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own categories"
  ON categories FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own categories"
  ON categories FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own categories"
  ON categories FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own categories"
  ON categories FOR DELETE
  USING (user_id = auth.uid()::text);

-- ============================================
-- 6. Bots Table
-- ============================================
CREATE TABLE bots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('welcome', 'auto', 'survey', 'ai')) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  ai_model TEXT,
  ai_prompt TEXT,
  user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_bots_user_id ON bots(user_id);
CREATE INDEX idx_bots_is_active ON bots(is_active);

-- RLS Policies
ALTER TABLE bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bots"
  ON bots FOR SELECT
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can insert their own bots"
  ON bots FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Users can update their own bots"
  ON bots FOR UPDATE
  USING (user_id = auth.uid()::text);

CREATE POLICY "Users can delete their own bots"
  ON bots FOR DELETE
  USING (user_id = auth.uid()::text);

-- ============================================
-- 7. Functions & Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_whatsapp_sessions_updated_at BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chats_updated_at BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bots_updated_at BEFORE UPDATE ON bots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. Realtime Subscriptions
-- ============================================

-- Enable realtime for important tables
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE chats;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
