-- Fix the chats RLS policy error
-- The error says: policy "Users can view chats from their sessions" depends on column "owner_id"
-- But chats table doesn't have owner_id, we need to join through whatsapp_sessions

-- First, let's drop ALL policies on chats
DROP POLICY IF EXISTS "Users can view chats from their sessions" ON chats;
DROP POLICY IF EXISTS "Users can insert chats for their sessions" ON chats;
DROP POLICY IF EXISTS "Users can update chats from their sessions" ON chats;
DROP POLICY IF EXISTS "Service role can do everything on chats" ON chats;

-- Now recreate them with the correct logic
-- We need to join through whatsapp_sessions to check owner_id

CREATE POLICY "Users can view chats from their sessions"
  ON chats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_sessions
      WHERE whatsapp_sessions.id = chats.session_id
      AND whatsapp_sessions.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert chats for their sessions"
  ON chats FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_sessions
      WHERE whatsapp_sessions.id = chats.session_id
      AND whatsapp_sessions.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update chats from their sessions"
  ON chats FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_sessions
      WHERE whatsapp_sessions.id = chats.session_id
      AND whatsapp_sessions.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can do everything on chats"
  ON chats
  USING (auth.role() = 'service_role');

-- Done! Now let's fix messages too
DROP POLICY IF EXISTS "Users can view messages from their sessions" ON messages;
DROP POLICY IF EXISTS "Users can insert messages for their sessions" ON messages;
DROP POLICY IF EXISTS "Users can update messages from their sessions" ON messages;
DROP POLICY IF EXISTS "Service role can do everything on messages" ON messages;

CREATE POLICY "Users can view messages from their sessions"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_sessions
      WHERE whatsapp_sessions.id = messages.session_id
      AND whatsapp_sessions.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages for their sessions"
  ON messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_sessions
      WHERE whatsapp_sessions.id = messages.session_id
      AND whatsapp_sessions.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages from their sessions"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_sessions
      WHERE whatsapp_sessions.id = messages.session_id
      AND whatsapp_sessions.owner_id = auth.uid()
    )
  );

CREATE POLICY "Service role can do everything on messages"
  ON messages
  USING (auth.role() = 'service_role');
