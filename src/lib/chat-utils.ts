/**
 * Chat Utilities - Canonical chat management
 *
 * Ensures a single canonical chat per (session_id, remote_id).
 * Handles:
 * - JID normalization (phone JID + LID JID)
 * - Safe upsert
 * - Safe LID <-> phone linking with merge (messages reassignment)
 */

import { supabaseAdmin } from './supabaseAdmin';

/**
 * Normalize any phone/JID input to canonical formats:
 *
 * Phone JID canonical: digits@s.whatsapp.net
 * LID canonical (if explicit @lid): digits@lid
 *
 * Accepts:
 * - +201234567890
 * - 201234567890
 * - 201234567890@s.whatsapp.net
 * - +20 123 456 7890
 * - 146784835875021@s.whatsapp.net (LID-like numeric jid)
 * - 146784835875021@lid
 */
export function normalizeJid(input: string): string {
  if (!input) throw new Error('JID input is required');

  const trimmed = String(input).trim();

  // Preserve explicit @lid
  if (trimmed.includes('@lid')) {
    const left = trimmed.split('@')[0];
    const digits = left.replace(/\D/g, '');
    if (!digits) throw new Error(`Invalid LID: ${input}`);
    return `${digits}@lid`;
  }

  // If already contains "@", normalize the left side to digits but keep WhatsApp phone domain
  if (trimmed.includes('@')) {
    const [left] = trimmed.split('@');
    const digits = left.replace(/\D/g, '');
    if (digits.length < 6) throw new Error(`Invalid JID: ${input}`);
    // We normalize all non-@lid domains to @s.whatsapp.net (covers phone and LID-like numeric JIDs)
    return `${digits}@s.whatsapp.net`;
  }

  // Raw phone number -> @s.whatsapp.net
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 10) {
    throw new Error(`Invalid phone: ${input} - must have at least 10 digits`);
  }
  return `${digits}@s.whatsapp.net`;
}

/**
 * Phone JID: 10-15 digits@s.whatsapp.net
 */
export function isPhoneJid(jid: string): boolean {
  if (!jid) return false;
  if (jid.endsWith('@lid')) return false;

  const m = jid.match(/^(\d+)@s\.whatsapp\.net$/);
  if (!m) return false;
  const digits = m[1];
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * LID:
 * - explicit @lid
 * - OR numeric jid that looks "longer than phone" like 16+ digits@s.whatsapp.net
 */
export function isLidJid(jid: string): boolean {
  if (!jid) return false;
  if (jid.endsWith('@lid')) return true;

  const m = jid.match(/^(\d+)@s\.whatsapp\.net$/);
  if (!m) return false;
  const digits = m[1];
  return digits.length > 15;
}

/**
 * Extract numeric part from a JID (digits before @)
 */
export function extractJidNumber(jid: string): string {
  if (!jid) return '';
  return jid.split('@')[0] ?? '';
}

/**
 * Internal: move references (messages) from duplicateChatId -> primaryChatId then delete duplicate chat.
 * Adjust table/column names here if your schema differs.
 */
async function mergeChats(sessionId: string, primaryChatId: string, duplicateChatId: string) {
  if (primaryChatId === duplicateChatId) return;

  console.log(
    `[mergeChats] sessionId=${sessionId} primary=${primaryChatId} duplicate=${duplicateChatId} (reassign messages -> delete duplicate)`
  );

  // 1) Reassign messages
  const { error: msgErr } = await supabaseAdmin
    .from('messages')
    .update({ chat_id: primaryChatId })
    .eq('chat_id', duplicateChatId);

  if (msgErr) {
    console.error('[mergeChats] Failed to reassign messages:', msgErr);
    throw new Error(`mergeChats: failed to reassign messages: ${msgErr.message}`);
  }

  // 2) Delete duplicate chat
  const { error: delErr } = await supabaseAdmin
    .from('chats')
    .delete()
    .eq('id', duplicateChatId)
    .eq('session_id', sessionId);

  if (delErr) {
    console.error('[mergeChats] Failed to delete duplicate chat:', delErr);
    throw new Error(`mergeChats: failed to delete duplicate chat: ${delErr.message}`);
  }

  console.log('[mergeChats] Done');
}

/**
 * Internal: safely set remote_id for a chat, merging if another chat already has that remote_id.
 */
async function safeSetRemoteId(sessionId: string, chatId: string, newRemoteId: string) {
  // Is there another chat already using (session_id, remote_id=newRemoteId)?
  const { data: otherChat } = await supabaseAdmin
    .from('chats')
    .select('id, remote_id, phone_jid')
    .eq('session_id', sessionId)
    .eq('remote_id', newRemoteId)
    .neq('id', chatId)
    .limit(1)
    .maybeSingle();

  if (otherChat?.id) {
    // Merge otherChat into chatId, then set remote_id
    await mergeChats(sessionId, chatId, otherChat.id);
  }

  // Now update remote_id (should not violate unique after merge)
  const { error: upErr } = await supabaseAdmin
    .from('chats')
    .update({ remote_id: newRemoteId, updated_at: new Date().toISOString() })
    .eq('id', chatId)
    .eq('session_id', sessionId);

  if (upErr) {
    // If still unique violation due to race, attempt one more merge path
    if (upErr.code === '23505') {
      const { data: raceOther } = await supabaseAdmin
        .from('chats')
        .select('id')
        .eq('session_id', sessionId)
        .eq('remote_id', newRemoteId)
        .neq('id', chatId)
          .limit(1)
          .maybeSingle();

      if (raceOther?.id) {
        await mergeChats(sessionId, chatId, raceOther.id);

        const { error: retryErr } = await supabaseAdmin
          .from('chats')
          .update({ remote_id: newRemoteId, updated_at: new Date().toISOString() })
          .eq('id', chatId)
          .eq('session_id', sessionId);

        if (!retryErr) return;
        throw new Error(`safeSetRemoteId retry failed: ${retryErr.message}`);
      }
    }

    throw new Error(`safeSetRemoteId failed: ${upErr.message}`);
  }
}

/**
 * Upsert chat - Find or create a canonical chat.
 *
 * Priority:
 * 1) session_id + remote_id
 * 2) session_id + phone_jid (if provided)
 * 3) create new
 *
 * If phone_jid match is found but remote_id differs, we safely update remote_id (merge-safe).
 */
export async function upsertChat(
  sessionId: string,
  remoteJidInput: string,
  phoneJidInput?: string,
  options: {
    name?: string;
    type?: 'INDIVIDUAL' | 'GROUP';
    lastMessage?: string;
  } = {}
): Promise<{ chat: any; isNew: boolean }> {
  const { name, type = 'INDIVIDUAL', lastMessage } = options;

  const remoteJid = normalizeJid(remoteJidInput);
  const phoneJid = phoneJidInput ? normalizeJid(phoneJidInput) : undefined;

  console.log(
    `[upsertChat] sessionId=${sessionId}, remoteJid=${remoteJid}, phoneJid=${phoneJid || 'N/A'}`
  );

  // Step 1: Find by remote_id (exact match)
  const { data: existingByRemoteId } = await supabaseAdmin
    .from('chats')
    .select('*')
    .eq('session_id', sessionId)
    .eq('remote_id', remoteJid)
    .limit(1)
    .maybeSingle();

  if (existingByRemoteId) {
    console.log(`[upsertChat] Found existing chat by remote_id: ${existingByRemoteId.id}`);

    // If phoneJid provided and missing, set it
    if (phoneJid && !existingByRemoteId.phone_jid) {
      await supabaseAdmin
        .from('chats')
        .update({ phone_jid: phoneJid, updated_at: new Date().toISOString() })
        .eq('id', existingByRemoteId.id);
      existingByRemoteId.phone_jid = phoneJid;
    }

    return { chat: existingByRemoteId, isNew: false };
  }

  // Step 2: If phoneJid provided, find by phone_jid and (optionally) link remote_id
  if (phoneJid) {
    const { data: existingByPhoneJid } = await supabaseAdmin
      .from('chats')
      .select('*')
      .eq('session_id', sessionId)
      .eq('phone_jid', phoneJid)
        .limit(1)
        .maybeSingle();

    if (existingByPhoneJid) {
      console.log(`[upsertChat] Found existing chat by phone_jid: ${existingByPhoneJid.id}`);

      // If remote differs, set remote_id to remoteJid (merge-safe)
      if (existingByPhoneJid.remote_id !== remoteJid) {
        console.log(`[upsertChat] Linking remote_id: ${existingByPhoneJid.remote_id} -> ${remoteJid}`);
        await safeSetRemoteId(sessionId, existingByPhoneJid.id, remoteJid);
        existingByPhoneJid.remote_id = remoteJid;
      }

      return { chat: existingByPhoneJid, isNew: false };
    }
  }

  // Step 3: No existing found, create new
  const insertData: any = {
    session_id: sessionId,
    remote_id: remoteJid,
    name: name || extractJidNumber(remoteJid),
    type,
    status: 'INBOX',
    mode: 'ai',
    is_unread: false,
    is_read: true,
    is_muted: false,
    is_archived: false,
    is_group: type === 'GROUP',
    needs_human: false,
    last_message_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Set phone_jid if we know it
  if (phoneJid) {
    insertData.phone_jid = phoneJid;
  } else if (isPhoneJid(remoteJid)) {
    insertData.phone_jid = remoteJid;
  }

  if (lastMessage) insertData.last_message = lastMessage;

  const { data: newChat, error: insertError } = await supabaseAdmin
    .from('chats')
    .insert(insertData)
    .select()
    .single();

  if (insertError) {
    // Unique constraint violation (race) -> fetch existing
    if (insertError.code === '23505') {
      console.log('[upsertChat] Race condition detected, fetching existing by remote_id');

      const { data: raceChat } = await supabaseAdmin
        .from('chats')
        .select('*')
        .eq('session_id', sessionId)
        .eq('remote_id', remoteJid)
            .limit(1)
            .maybeSingle();

      if (raceChat) return { chat: raceChat, isNew: false };

      // fallback: if phoneJid is known, try by phone_jid
      if (phoneJid) {
        const { data: raceByPhone } = await supabaseAdmin
          .from('chats')
          .select('*')
          .eq('session_id', sessionId)
          .eq('phone_jid', phoneJid)
              .limit(1)
              .maybeSingle();

        if (raceByPhone) return { chat: raceByPhone, isNew: false };
      }
    }

    console.error('[upsertChat] Error creating chat:', insertError);
    throw new Error(`Failed to create chat: ${insertError.message}`);
  }

  console.log(`[upsertChat] Created new chat: ${newChat.id}`);
  return { chat: newChat, isNew: true };
}

/**
 * Link a discovered LID to an existing phone-based chat (merge-safe).
 *
 * Rules:
 * - If phone chat exists: make it primary, merge any existing LID chat into it, then set remote_id=LID.
 * - If phone chat doesn't exist but LID chat exists: set its phone_jid=phoneJid.
 * - If neither exists: create new chat with remote_id=LID and phone_jid=phoneJid.
 */
export async function linkLidToPhone(
  sessionId: string,
  lidJidInput: string,
  phoneJidInput: string
): Promise<void> {
  const lidJid = normalizeJid(lidJidInput); // will preserve @lid if provided
  const phoneJid = normalizeJid(phoneJidInput);

  console.log(`[linkLidToPhone] sessionId=${sessionId} lid=${lidJid} phone=${phoneJid}`);

  // Find chat by phone_jid
  const { data: phoneChat } = await supabaseAdmin
    .from('chats')
    .select('*')
    .eq('session_id', sessionId)
    .eq('phone_jid', phoneJid)
    .limit(1)
    .maybeSingle();

  // Find chat by lid remote_id
  const { data: lidChat } = await supabaseAdmin
    .from('chats')
    .select('*')
    .eq('session_id', sessionId)
    .eq('remote_id', lidJid)
    .limit(1)
    .maybeSingle();

  // Case A: both exist and different -> merge lidChat into phoneChat, set remote_id
  if (phoneChat && lidChat && phoneChat.id !== lidChat.id) {
    await mergeChats(sessionId, phoneChat.id, lidChat.id);

    // Ensure phone_jid set (already), then set remote_id safely
    if (phoneChat.remote_id !== lidJid) {
      await safeSetRemoteId(sessionId, phoneChat.id, lidJid);
    }

    console.log(`[linkLidToPhone] ✅ merged lidChat into phoneChat=${phoneChat.id} and set remote_id=${lidJid}`);
    return;
  }

  // Case B: phone chat exists only -> set remote_id to LID (merge-safe) + ensure phone_jid
  if (phoneChat && !lidChat) {
    // Ensure phone_jid is set
    if (!phoneChat.phone_jid) {
      await supabaseAdmin
        .from('chats')
        .update({ phone_jid: phoneJid, updated_at: new Date().toISOString() })
        .eq('id', phoneChat.id)
        .eq('session_id', sessionId);
    }

    if (phoneChat.remote_id !== lidJid) {
      await safeSetRemoteId(sessionId, phoneChat.id, lidJid);
    }

    console.log(`[linkLidToPhone] ✅ updated phoneChat=${phoneChat.id} remote_id=${lidJid}`);
    return;
  }

  // Case C: LID chat exists only -> set phone_jid
  if (!phoneChat && lidChat) {
    if (!lidChat.phone_jid) {
      await supabaseAdmin
        .from('chats')
        .update({ phone_jid: phoneJid, updated_at: new Date().toISOString() })
        .eq('id', lidChat.id)
        .eq('session_id', sessionId);
    }

    console.log(`[linkLidToPhone] ✅ updated lidChat=${lidChat.id} phone_jid=${phoneJid}`);
    return;
  }

  // Case D: neither exists -> create chat with remote_id=LID and phone_jid=phone
  await upsertChat(sessionId, lidJid, phoneJid, {
    name: extractJidNumber(phoneJid),
    type: 'INDIVIDUAL',
  });

  console.log('[linkLidToPhone] ✅ created new chat with LID remote_id + phone_jid');
}
