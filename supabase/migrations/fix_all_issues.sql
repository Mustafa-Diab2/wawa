-- Complete cleanup and fix for all issues
-- Run this in Supabase SQL Editor

-- 1. Drop the foreign key constraint temporarily
ALTER TABLE IF EXISTS chats DROP CONSTRAINT IF EXISTS chats_session_id_fkey;

-- 2. Delete all chats first
DELETE FROM chats;

-- 3. Delete all sessions
DELETE FROM whatsapp_sessions;

-- 4. Recreate the foreign key with CASCADE
ALTER TABLE chats
ADD CONSTRAINT chats_session_id_fkey
FOREIGN KEY (session_id)
REFERENCES whatsapp_sessions(id)
ON DELETE CASCADE;

-- 5. Make sure remote_jid exists and is populated
DO $$
BEGIN
  -- Add remote_jid column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chats' AND column_name = 'remote_jid'
  ) THEN
    ALTER TABLE chats ADD COLUMN remote_jid TEXT;
  END IF;
END $$;

-- 6. Add unique constraint on remote_jid and session_id
DO $$
BEGIN
  -- Drop existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chats_remote_jid_session_id_unique'
  ) THEN
    ALTER TABLE chats DROP CONSTRAINT chats_remote_jid_session_id_unique;
  END IF;

  -- Add new constraint
  ALTER TABLE chats
  ADD CONSTRAINT chats_remote_jid_session_id_unique
  UNIQUE (remote_jid, session_id);
END $$;

-- 7. Create index for performance
CREATE INDEX IF NOT EXISTS idx_chats_remote_jid_session_id
ON chats(remote_jid, session_id);

-- 8. Verify cleanup
SELECT 'Sessions count:' as info, COUNT(*) as count FROM whatsapp_sessions
UNION ALL
SELECT 'Chats count:' as info, COUNT(*) as count FROM chats;
