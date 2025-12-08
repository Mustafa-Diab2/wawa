-- Clean up old WhatsApp sessions
-- This will delete all existing sessions and allow fresh start

-- Delete all existing sessions
DELETE FROM public.whatsapp_sessions;

-- Verify deletion
SELECT COUNT(*) as remaining_sessions FROM public.whatsapp_sessions;
