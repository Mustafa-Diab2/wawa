import type { Message } from "@/lib/types";

/**
 * Normalize the possible identifiers a message can have across the app.
 * We consider provider id, client request id, legacy camelCase names, and the db id.
 */
export function messageKeys(msg: Partial<Message> | any): string[] {
  const keys: string[] = [];
  const candidates = [
    (msg as any)?.provider_message_id,
    (msg as any)?.providerMessageId,
    (msg as any)?.client_request_id,
    (msg as any)?.clientRequestId,
    (msg as any)?.id,
  ];

  for (const key of candidates) {
    if (key) keys.push(String(key));
  }

  return keys;
}

/**
 * Remove duplicates from a list of messages using all available identifiers.
 * Keeps the first occurrence to preserve original ordering.
 */
export function dedupeMessages(list: Message[] = []): Message[] {
  const seen = new Set<string>();
  const result: Message[] = [];

  for (const msg of list || []) {
    const keys = messageKeys(msg);
    if (keys.some((k) => seen.has(k))) continue;
    keys.forEach((k) => seen.add(k));
    result.push(msg);
  }

  return result;
}

/**
 * Upsert a single message into a list, replacing any message that shares
 * an identifier (provider/client/db id) to avoid duplicates.
 */
export function upsertMessage(list: Message[] = [], incoming: Message): Message[] {
  const incomingKeys = new Set(messageKeys(incoming));
  let replaced = false;

  const next = (list || []).map((msg) => {
    const keys = messageKeys(msg);
    if (keys.some((k) => incomingKeys.has(k))) {
      replaced = true;
      return incoming;
    }
    return msg;
  });

  if (!replaced) {
    next.push(incoming);
  }

  return dedupeMessages(next);
}
