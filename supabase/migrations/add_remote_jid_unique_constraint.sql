-- Add remote_jid column and unique constraint to prevent duplicate chats
-- This ensures that one phone number can only have one chat per session

-- Step 1: Add remote_jid column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chats' AND column_name = 'remote_jid'
  ) THEN
    ALTER TABLE chats ADD COLUMN remote_jid TEXT;
  END IF;
END $$;

-- Step 2: Copy data from remote_id to remote_jid for existing records
UPDATE chats
SET remote_jid = remote_id
WHERE remote_jid IS NULL AND remote_id IS NOT NULL;

-- Step 3: Remove any duplicate chats (keep the most recent one)
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY remote_jid, session_id
      ORDER BY created_at DESC
    ) as rn
  FROM chats
  WHERE remote_jid IS NOT NULL
)
DELETE FROM chats
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 4: Add unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chats_remote_jid_session_id_unique'
  ) THEN
    ALTER TABLE chats
    ADD CONSTRAINT chats_remote_jid_session_id_unique
    UNIQUE (remote_jid, session_id);
  END IF;
END $$;

-- Step 5: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_chats_remote_jid_session_id
ON chats(remote_jid, session_id);
