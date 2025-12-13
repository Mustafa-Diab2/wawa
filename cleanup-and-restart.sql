-- Complete cleanup script
-- Run this in Supabase SQL Editor

-- Delete all chats
DELETE FROM chats;

-- Delete all messages
DELETE FROM messages;

-- Delete all sessions
DELETE FROM whatsapp_sessions;

-- Verify cleanup
SELECT 'Chats:' as table_name, COUNT(*) as count FROM chats
UNION ALL
SELECT 'Messages:', COUNT(*) FROM messages
UNION ALL
SELECT 'Sessions:', COUNT(*) FROM whatsapp_sessions;
