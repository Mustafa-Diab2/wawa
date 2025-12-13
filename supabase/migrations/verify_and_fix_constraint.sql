-- Verify and fix the unique constraint on chats table

-- Step 1: Check if remote_jid column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chats' AND column_name = 'remote_jid'
  ) THEN
    ALTER TABLE chats ADD COLUMN remote_jid TEXT;
    RAISE NOTICE 'Added remote_jid column';
  ELSE
    RAISE NOTICE 'remote_jid column already exists';
  END IF;
END $$;

-- Step 2: Update any NULL remote_jid values from remote_id
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

-- Step 4: Drop existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chats_remote_jid_session_id_unique'
  ) THEN
    ALTER TABLE chats DROP CONSTRAINT chats_remote_jid_session_id_unique;
    RAISE NOTICE 'Dropped existing constraint';
  END IF;
END $$;

-- Step 5: Add unique constraint
ALTER TABLE chats
ADD CONSTRAINT chats_remote_jid_session_id_unique
UNIQUE (remote_jid, session_id);

-- Step 6: Create index for performance
DROP INDEX IF EXISTS idx_chats_remote_jid_session_id;
CREATE INDEX idx_chats_remote_jid_session_id
ON chats(remote_jid, session_id);

-- Step 7: Verify the constraint was added
SELECT
    'Constraint exists: ' || conname as status
FROM pg_constraint
WHERE conrelid = 'chats'::regclass
AND conname = 'chats_remote_jid_session_id_unique';

-- Step 8: Show all chats to verify
SELECT
    id,
    remote_jid,
    session_id,
    created_at
FROM chats
ORDER BY created_at DESC;
