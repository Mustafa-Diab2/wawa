-- ============================================
-- Migration: Add client_request_id to messages for idempotent sends
-- ============================================
-- Run in Supabase SQL Editor

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS client_request_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_session_client_request_unique
ON public.messages(session_id, client_request_id)
WHERE client_request_id IS NOT NULL;
