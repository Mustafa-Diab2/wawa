-- ============================================
-- Migration: Fix Duplicate Chats Issue
-- ============================================
-- This migration ensures canonical chat uniqueness:
-- - One chat per (session_id, remote_id)
-- - phone_jid column for LID->Phone mapping
--
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- Step 1: Add phone_jid column to chats table
-- ============================================
ALTER TABLE chats ADD COLUMN IF NOT EXISTS phone_jid TEXT;

-- Create index for phone_jid lookups
CREATE INDEX IF NOT EXISTS idx_chats_phone_jid ON chats(phone_jid);

-- ============================================
-- Step 2: Ensure UNIQUE constraint on (session_id, remote_id)
-- ============================================
-- This is the PRIMARY constraint that prevents duplicate chats

-- First, check if constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chats_session_remote_unique'
    ) THEN
        -- Drop the old constraint if it exists with different name
        ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_session_id_remote_id_key;

        -- Add the unique constraint
        ALTER TABLE chats ADD CONSTRAINT chats_session_remote_unique
        UNIQUE (session_id, remote_id);
    END IF;
END $$;

-- ============================================
-- Step 3: Add partial unique index for phone_jid
-- ============================================
-- This prevents duplicate phone_jid within a session

DROP INDEX IF EXISTS chats_session_phone_unique;
CREATE UNIQUE INDEX chats_session_phone_unique
ON chats(session_id, phone_jid)
WHERE phone_jid IS NOT NULL;

-- ============================================
-- Step 3: Update existing chats to set phone_jid
-- ============================================
-- For chats where remote_id looks like a phone number (10-15 digits followed by @s.whatsapp.net)
-- set phone_jid to the remote_id

UPDATE chats
SET phone_jid = remote_id
WHERE phone_jid IS NULL
  AND remote_id ~ '^[0-9]{10,15}@s\.whatsapp\.net$';

-- ============================================
-- Step 4: Function to find or create chat with LID/Phone linking
-- ============================================
CREATE OR REPLACE FUNCTION find_or_create_chat(
    p_session_id UUID,
    p_remote_id TEXT,
    p_phone_jid TEXT DEFAULT NULL,
    p_name TEXT DEFAULT NULL,
    p_type TEXT DEFAULT 'INDIVIDUAL'
)
RETURNS UUID AS $$
DECLARE
    v_chat_id UUID;
    v_existing_chat_id UUID;
BEGIN
    -- First, try to find by remote_id (exact match)
    SELECT id INTO v_chat_id
    FROM chats
    WHERE session_id = p_session_id AND remote_id = p_remote_id
    LIMIT 1;

    IF v_chat_id IS NOT NULL THEN
        -- Update phone_jid if provided and not set
        IF p_phone_jid IS NOT NULL THEN
            UPDATE chats SET phone_jid = p_phone_jid WHERE id = v_chat_id AND phone_jid IS NULL;
        END IF;
        RETURN v_chat_id;
    END IF;

    -- If phone_jid is provided, try to find by phone_jid
    IF p_phone_jid IS NOT NULL THEN
        SELECT id INTO v_chat_id
        FROM chats
        WHERE session_id = p_session_id AND phone_jid = p_phone_jid
        LIMIT 1;

        IF v_chat_id IS NOT NULL THEN
            -- Update remote_id if different (this links LID to phone)
            IF p_remote_id != (SELECT remote_id FROM chats WHERE id = v_chat_id) THEN
                -- Don't update remote_id, just return the existing chat
                -- The chat was created with phone, now we're receiving from LID
            END IF;
            RETURN v_chat_id;
        END IF;
    END IF;

    -- No existing chat found, create new one
    INSERT INTO chats (session_id, remote_id, phone_jid, name, type, status, mode)
    VALUES (p_session_id, p_remote_id, p_phone_jid, COALESCE(p_name, split_part(p_remote_id, '@', 1)), p_type, 'INBOX', 'ai')
    RETURNING id INTO v_chat_id;

    RETURN v_chat_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 5: Helper function to check if JID is a phone number
-- ============================================
CREATE OR REPLACE FUNCTION is_phone_jid(jid TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Phone JID format: 10-15 digits followed by @s.whatsapp.net
    RETURN jid ~ '^[0-9]{10,15}@s\.whatsapp\.net$';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 6: Merge duplicate chats (run manually after review)
-- ============================================
-- This query shows potential duplicate chats to merge
-- SELECT
--     c1.id as phone_chat_id,
--     c1.remote_id as phone_remote_id,
--     c2.id as lid_chat_id,
--     c2.remote_id as lid_remote_id,
--     c1.session_id
-- FROM chats c1
-- JOIN chats c2 ON c1.session_id = c2.session_id
--     AND c1.id != c2.id
--     AND c1.remote_id ~ '^[0-9]{10,15}@s\.whatsapp\.net$'
--     AND c2.remote_id !~ '^[0-9]{10,15}@s\.whatsapp\.net$'
-- WHERE c1.session_id = 'YOUR_SESSION_ID';
