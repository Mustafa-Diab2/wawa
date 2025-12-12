-- ============================================
-- Migration: enforce unique provider_message_id per session
-- ============================================

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

-- Unique partial index to prevent duplicates when provider_message_id is present
DROP INDEX IF EXISTS idx_messages_session_provider_unique;
CREATE UNIQUE INDEX idx_messages_session_provider_unique
ON public.messages(session_id, provider_message_id)
WHERE provider_message_id IS NOT NULL;

-- Helper index for fast lookup
CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id
ON public.messages(provider_message_id);
