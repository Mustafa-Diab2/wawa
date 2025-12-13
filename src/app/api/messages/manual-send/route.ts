import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizeJid, upsertChat, isPhoneJid } from '@/lib/chat-utils';

const SCHEMA_MIGRATION_MESSAGE =
  'Database schema is out of date. Please run the latest Supabase migrations (provider_message_id + client_request_id) and retry.';

function isSchemaCacheError(error: any): boolean {
  const message = (error?.message || '').toLowerCase();
  const details = (error?.details || '').toLowerCase();
  return (
    message.includes('column') &&
      (message.includes('provider_message_id') || message.includes('client_request_id')) ||
    details.includes('cached plan') ||
    details.includes('schema') ||
    message.includes('schema cache')
  );
}

/**
 * Manual Send Message API
 *
 * POST /api/messages/manual-send
 * Body: { sessionId, to, text, assignedTo? }
 *
 * Creates a pending message for the worker to send.
 * IMPORTANT: chatId is DB UUID (NOT WhatsApp messageId)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, to, text, assignedTo, clientRequestId: rawClientRequestId } = body;
    const clientRequestId = rawClientRequestId || body.client_request_id || randomUUID();

    if (!sessionId || !to || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, to, text' },
        { status: 400 }
      );
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('whatsapp_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    let normalizedJid: string;
    try {
      normalizedJid = normalizeJid(to);
    } catch (e: any) {
      return NextResponse.json(
        { error: `Invalid phone/JID: ${e.message}` },
        { status: 400 }
      );
    }

    console.log(`[manual-send] sessionId=${sessionId}, to=${to}, normalizedJid=${normalizedJid}, clientRequestId=${clientRequestId || 'none'}`);

    if (clientRequestId) {
      const { data: existing } = await supabaseAdmin
        .from('messages')
        .select('id, chat_id')
        .eq('session_id', sessionId)
        .eq('client_request_id', clientRequestId)
        .limit(1)
        .maybeSingle();

      if (existing?.id && existing.chat_id) {
        console.log(`[manual-send] deduped existing message ${existing.id} for clientRequestId=${clientRequestId}`);
        return NextResponse.json({
          success: true,
          deduped: true,
          chatId: existing.chat_id,
          messageId: existing.id,
        });
      }
    }

    const phoneJidParam = isPhoneJid(normalizedJid) ? normalizedJid : undefined;

    const { chat, isNew } = await upsertChat(sessionId, normalizedJid, phoneJidParam, {
      name: (phoneJidParam || normalizedJid).split('@')[0],
      lastMessage: text,
    });

    const chatId = chat.id;
    console.log(`[manual-send] chat.id=${chatId}, isNew=${isNew}`);

    if (assignedTo) {
      await supabaseAdmin.from('chats').update({ assigned_to: assignedTo }).eq('id', chatId);
    }

    // Use phone_jid for sending (worker will discover LID from response)
    const sendToJid = chat.phone_jid || normalizedJid;

    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: chatId,
        session_id: sessionId,
        remote_id: sendToJid,
        sender: 'agent',
        body: text,
        timestamp: new Date().toISOString(),
        is_from_us: true,
        media_type: null,
        media_url: null,
        status: 'pending',
        client_request_id: clientRequestId,
        provider_message_id: null, // filled after Baileys sendMessage in worker
      })
      .select()
      .single();

    if (messageError) {
      if (isSchemaCacheError(messageError)) {
        return NextResponse.json(
          { error: SCHEMA_MIGRATION_MESSAGE, needs_migration: true },
          { status: 400 }
        );
      }

      if (messageError.code === '23505' && clientRequestId) {
        const { data: existingAfterInsert } = await supabaseAdmin
          .from('messages')
          .select('id, chat_id')
          .eq('session_id', sessionId)
          .eq('client_request_id', clientRequestId)
          .limit(1)
          .maybeSingle();

        if (existingAfterInsert?.id && existingAfterInsert.chat_id) {
          console.log(`[manual-send] deduped on unique index for clientRequestId=${clientRequestId}`);
          return NextResponse.json({
            success: true,
            deduped: true,
            chatId: existingAfterInsert.chat_id,
            messageId: existingAfterInsert.id,
            clientRequestId,
          });
        }
      }

      console.error('[manual-send] insert messageError:', messageError);
      return NextResponse.json(
        {
          error: messageError.message,
          code: messageError.code,
          details: messageError.details,
          hint: messageError.hint,
        },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from('chats')
      .update({
        last_message: text,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId);

    console.log(`[manual-send] SUCCESS: chatId=${chatId}, messageId=${message.id}, clientRequestId=${clientRequestId || 'none'}`);

    return NextResponse.json({
      success: true,
      deduped: false,
      chatId,
      messageId: message.id,
      clientRequestId,
      remoteId: chat.remote_id,
      chat: {
        id: chat.id,
        remote_id: chat.remote_id,
        phone_jid: chat.phone_jid,
        name: chat.name,
      },
    });
  } catch (error: any) {
    console.error('[manual-send] Error:', error);
    if (isSchemaCacheError(error)) {
      return NextResponse.json(
        { error: SCHEMA_MIGRATION_MESSAGE, needs_migration: true },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
