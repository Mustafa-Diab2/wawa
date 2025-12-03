-- Fix RLS Policies to work with Supabase Auth
-- The owner_id should be UUID type, not TEXT
-- Run this in your Supabase SQL Editor

-- 1. Drop existing policies on whatsapp_sessions
DROP POLICY IF EXISTS "Users can view their own sessions" ON whatsapp_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON whatsapp_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON whatsapp_sessions;
DROP POLICY IF EXISTS "Service role can do everything on sessions" ON whatsapp_sessions;

-- 2. Alter the owner_id column to UUID type
ALTER TABLE whatsapp_sessions ALTER COLUMN owner_id TYPE UUID USING owner_id::uuid;

-- 3. Create new RLS policies with correct UUID comparison
CREATE POLICY "Users can view their own sessions"
  ON whatsapp_sessions FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert their own sessions"
  ON whatsapp_sessions FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
  ON whatsapp_sessions FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "Service role can do everything on sessions"
  ON whatsapp_sessions
  USING (auth.role() = 'service_role');

-- 4. Do the same for chats table
DROP POLICY IF EXISTS "Users can view chats from their sessions" ON chats;
DROP POLICY IF EXISTS "Users can insert chats for their sessions" ON chats;
DROP POLICY IF EXISTS "Users can update chats from their sessions" ON chats;
DROP POLICY IF EXISTS "Service role can do everything on chats" ON chats;

CREATE POLICY "Users can view chats from their sessions"
  ON chats FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert chats for their sessions"
  ON chats FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update chats from their sessions"
  ON chats FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can do everything on chats"
  ON chats
  USING (auth.role() = 'service_role');

-- 5. Do the same for messages table
DROP POLICY IF EXISTS "Users can view messages from their sessions" ON messages;
DROP POLICY IF EXISTS "Users can insert messages for their sessions" ON messages;
DROP POLICY IF EXISTS "Users can update messages from their sessions" ON messages;
DROP POLICY IF EXISTS "Service role can do everything on messages" ON messages;

CREATE POLICY "Users can view messages from their sessions"
  ON messages FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages for their sessions"
  ON messages FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages from their sessions"
  ON messages FOR UPDATE
  USING (
    session_id IN (
      SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can do everything on messages"
  ON messages
  USING (auth.role() = 'service_role');

-- Done! Now anonymous users should be able to create sessions
