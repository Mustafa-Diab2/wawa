-- Cleanup old WhatsApp sessions
-- Keep only the most recent session per user

-- Delete all sessions except the most recent one for each user
DELETE FROM whatsapp_sessions
WHERE id NOT IN (
  SELECT DISTINCT ON (owner_id) id
  FROM whatsapp_sessions
  ORDER BY owner_id, created_at DESC
);

-- Reset the remaining sessions (clear QR and set not ready)
UPDATE whatsapp_sessions
SET
  qr = '',
  is_ready = false,
  should_disconnect = false,
  updated_at = NOW();
