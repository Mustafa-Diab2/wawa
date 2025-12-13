-- Fix: Delete ALL sessions and let the app create fresh ones

-- 1. Delete all sessions
TRUNCATE TABLE whatsapp_sessions;

-- 2. Delete all auth files (will be recreated)
-- Note: This needs to be done manually by deleting the auth_info_baileys folder
