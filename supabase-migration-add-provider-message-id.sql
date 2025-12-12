-- ============================================
-- Migration: Add provider_message_id to messages
-- ============================================
-- This migration adds a provider_message_id column to prevent duplicate messages.
-- The column stores the WhatsApp message ID from Baileys.
--
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Add provider_message_id column
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Step 2: Create index on provider_message_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id
ON public.messages(provider_message_id);

-- Step 3: Create UNIQUE partial index to prevent duplicates
-- This ensures no two messages with the same (session_id, provider_message_id) where provider_message_id is not null
DROP INDEX IF EXISTS idx_messages_session_provider_unique;
CREATE UNIQUE INDEX idx_messages_session_provider_unique
ON public.messages(session_id, provider_message_id)
WHERE provider_message_id IS NOT NULL;

-- Step 4: (Optional) Backfill phone_jid for chats where it's missing but remote_id is a phone number
-- This helps display phone numbers instead of LIDs
UPDATE public.chats
SET phone_jid = remote_id
WHERE phone_jid IS NULL
  AND remote_id ~ '^[0-9]{10,15}@s\.whatsapp\.net$';

-- Step 5: (Optional) Update chat names to use phone number if name is LID-like
UPDATE public.chats
SET name = SPLIT_PART(phone_jid, '@', 1)
WHERE phone_jid IS NOT NULL
  AND (name IS NULL OR name ~ '^[0-9]{16,}$');
