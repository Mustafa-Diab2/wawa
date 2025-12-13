/**
 * Chat Utilities - Canonical chat management
 *
 * This module ensures a single canonical chat per (session_id, remote_id).
 * It handles JID normalization and chat upsert operations.
 */

import { supabaseAdmin } from './supabaseAdmin';

/**
 * Normalize any phone/JID input to canonical format: digits@s.whatsapp.net
 *
 * Accepts:
 * - +201234567890
 * - 201234567890
 * - 201234567890@s.whatsapp.net
 * - +20 123 456 7890
 *
 * Returns: 201234567890@s.whatsapp.net
 */
export function normalizeJid(input: string): string {
  if (!input) {
    throw new Error('JID input is required');
  }

  // Remove all non-digit characters except @
  let normalized = input;

  // If already has @s.whatsapp.net, extract digits
  if (normalized.includes('@')) {
    normalized = normalized.split('@')[0];
  }

  // Remove all non-digit characters (spaces, +, -, etc.)
  const digits = normalized.replace(/\D/g, '');

  if (digits.length < 10) {
    throw new Error(`Invalid JID: ${input} - must have at least 10 digits`);
  }

  // Return canonical format
  return `${digits}@s.whatsapp.net`;
}

/**
 * Check if a JID is a phone-based JID (not LID)
 * Phone JIDs: 10-15 digits followed by @s.whatsapp.net
 * LID JIDs: longer numbers or @lid suffix
 */
export function isPhoneJid(jid: string): boolean {
  if (!jid) return false;
  const match = jid.match(/^(\d+)@s\.whatsapp\.net$/);
  if (!match) return false;
  const digits = match[1];
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Check if a JID is a LID (Local ID) format
 * LIDs are typically longer numbers or end with @lid
 */
export function isLidJid(jid: string): boolean {
  if (!jid) return false;
  if (jid.endsWith('@lid')) return true;
  const match = jid.match(/^(\d+)@s\.whatsapp\.net$/);
  if (!match) return false;
  const digits = match[1];
  return digits.length > 15;
}

/**
 * Extract the numeric part from a JID
 */
export function extractJidNumber(jid: string): string {
  if (!jid) return '';
  return jid.split('@')[0];
}

/**
 * Upsert chat - Find or create a canonical chat for (session_id, remote_id)
 *
 * This ensures only ONE chat exists per session + contact combination.
 *
 * @param sessionId - The WhatsApp session UUID
 * @param remoteJid - The normalized remote JID (from normalizeJid)
 * @param phoneJid - Optional phone JID for LID mapping
 * @param options - Additional chat creation options
 * @returns The chat record (existing or newly created)
 */
export async function upsertChat(
  sessionId: string,
  remoteJid: string,
  phoneJid?: string,
  options: {
    name?: string;
    type?: 'INDIVIDUAL' | 'GROUP';
    lastMessage?: string;
  } = {}
): Promise<{ chat: any; isNew: boolean }> {
  const { name, type = 'INDIVIDUAL', lastMessage } = options;
  const phoneJidSafe = phoneJid && isPhoneJid(phoneJid) ? phoneJid : undefined;

  console.log(`[upsertChat] sessionId=${sessionId}, remoteJid=${remoteJid}, phoneJid=${phoneJidSafe || 'N/A'}`);

  // Step 1: Try to find by remote_id (exact match - highest priority)
  const { data: existingByRemoteId } = await supabaseAdmin
    .from('chats')
    .select('*')
    .eq('session_id', sessionId)
    .eq('remote_id', remoteJid)
    .limit(1)
    .single();

  if (existingByRemoteId) {
    console.log(`[upsertChat] Found existing chat by remote_id: ${existingByRemoteId.id}`);

    // Update phone_jid if provided and not set
    if (phoneJidSafe && !existingByRemoteId.phone_jid) {
      await supabaseAdmin
        .from('chats')
        .update({ phone_jid: phoneJidSafe, updated_at: new Date().toISOString() })
        .eq('id', existingByRemoteId.id);
      existingByRemoteId.phone_jid = phoneJidSafe;
    }

    return { chat: existingByRemoteId, isNew: false };
  }

  // Step 2: If phone_jid provided, try to find by phone_jid
  if (phoneJidSafe) {
    const { data: existingByPhoneJid } = await supabaseAdmin
      .from('chats')
      .select('*')
      .eq('session_id', sessionId)
      .eq('phone_jid', phoneJidSafe)
      .limit(1)
      .single();

    if (existingByPhoneJid) {
      console.log(`[upsertChat] Found existing chat by phone_jid: ${existingByPhoneJid.id}`);

      // Update remote_id if it's different (linking LID to phone)
      if (existingByPhoneJid.remote_id !== remoteJid) {
        console.log(`[upsertChat] Linking: ${existingByPhoneJid.remote_id} -> ${remoteJid}`);
        await supabaseAdmin
          .from('chats')
          .update({ remote_id: remoteJid, updated_at: new Date().toISOString() })
          .eq('id', existingByPhoneJid.id);
        existingByPhoneJid.remote_id = remoteJid;
      }

      return { chat: existingByPhoneJid, isNew: false };
    }
  }

  // Step 3: For phone JIDs, also check if phone_jid matches remoteJid
  if (isPhoneJid(remoteJid)) {
    const { data: existingByPhoneAsRemote } = await supabaseAdmin
      .from('chats')
      .select('*')
      .eq('session_id', sessionId)
      .eq('phone_jid', remoteJid)
      .limit(1)
      .single();

    if (existingByPhoneAsRemote) {
      console.log(`[upsertChat] Found existing chat where phone_jid matches remoteJid: ${existingByPhoneAsRemote.id}`);
      return { chat: existingByPhoneAsRemote, isNew: false };
    }
  }

  // Step 4: No existing chat found - create new one
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

  // Set phone_jid for phone-based JIDs
  if (isPhoneJid(remoteJid)) {
    insertData.phone_jid = remoteJid;
  } else if (phoneJid) {
    insertData.phone_jid = phoneJid;
  }

  if (lastMessage) {
    insertData.last_message = lastMessage;
  }

  const { data: newChat, error: insertError } = await supabaseAdmin
    .from('chats')
    .insert(insertData)
    .select()
    .single();

  if (insertError) {
    // Handle race condition - another process might have created the chat
    if (insertError.code === '23505') { // Unique constraint violation
      console.log(`[upsertChat] Race condition detected, fetching existing chat`);
      const { data: raceChat } = await supabaseAdmin
        .from('chats')
        .select('*')
        .eq('session_id', sessionId)
        .eq('remote_id', remoteJid)
        .limit(1)
        .single();

      if (raceChat) {
        return { chat: raceChat, isNew: false };
      }
    }

    console.error(`[upsertChat] Error creating chat:`, insertError);
    throw new Error(`Failed to create chat: ${insertError.message}`);
  }

  console.log(`[upsertChat] Created new chat: ${newChat.id}`);
  return { chat: newChat, isNew: true };
}

/**
 * Link a LID to an existing phone-based chat
 * Call this when you discover a LID -> Phone mapping
 */
export async function linkLidToPhone(
  sessionId: string,
  lidJid: string,
  phoneJid: string
): Promise<void> {
  console.log(`[linkLidToPhone] Linking LID ${lidJid} to phone ${phoneJid}`);

  // Find the chat by phone_jid
  const { data: existingChat } = await supabaseAdmin
    .from('chats')
    .select('*')
    .eq('session_id', sessionId)
    .eq('phone_jid', phoneJid)
    .limit(1)
    .single();

  if (existingChat) {
    // Update remote_id to LID
    await supabaseAdmin
      .from('chats')
      .update({
        remote_id: lidJid,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingChat.id);

    console.log(`[linkLidToPhone] Updated chat ${existingChat.id} remote_id to ${lidJid}`);
  }
}
