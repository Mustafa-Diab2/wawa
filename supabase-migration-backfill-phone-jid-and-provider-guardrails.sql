-- Backfill phone_jid where remote_id is already a phone-based JID
UPDATE public.chats AS c
SET phone_jid = c.remote_id,
    updated_at = NOW()
WHERE c.phone_jid IS NULL
  AND c.remote_id ~ '^[0-9]{10,15}@s\\.whatsapp\\.net$';

-- Backfill phone_jid for LID chats using any phone-based message JIDs in the same chat
UPDATE public.chats AS c
SET phone_jid = m.remote_id,
    updated_at = NOW()
FROM (
  SELECT chat_id, MAX(remote_id) AS remote_id
  FROM public.messages
  WHERE remote_id ~ '^[0-9]{10,15}@s\\.whatsapp\\.net$'
  GROUP BY chat_id
) AS m
WHERE c.phone_jid IS NULL
  AND c.id = m.chat_id
  AND (c.remote_id LIKE '%@lid' OR c.remote_id ~ '^[0-9]{16,}@s\\.whatsapp\\.net$');

-- Recreate unique partial index to guard against duplicate provider_message_id per session
DROP INDEX IF EXISTS idx_messages_session_provider_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_session_provider_unique
ON public.messages(session_id, provider_message_id)
WHERE provider_message_id IS NOT NULL;
