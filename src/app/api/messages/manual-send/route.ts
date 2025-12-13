import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, to, text, assignedTo } = body;

    // Validation
    if (!sessionId || !to || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, to, text' },
        { status: 400 }
      );
    }

    // Check if session exists and is ready
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('whatsapp_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Skip is_ready check in development mode
    // if (!session.is_ready) {
    //   return NextResponse.json(
    //     { error: 'WhatsApp not connected. Please connect first.' },
    //     { status: 400 }
    //   );
    // }

    // Normalize JID (should already be in format: 201234567890@s.whatsapp.net)
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    // Use upsert to create or get existing chat - this ensures we always use the same chat
    const { data: chatData, error: chatError } = await supabaseAdmin
      .from('chats')
      .upsert(
        {
          session_id: sessionId,
          remote_id: jid, // Primary field for uniqueness
          phone_jid: jid, // For LID mapping
          name: jid.split('@')[0], // Use phone number as name initially
          type: 'INDIVIDUAL',
          status: 'INBOX',
          is_unread: false,
          last_message: text,
          last_message_at: new Date().toISOString(),
          assigned_to: assignedTo || null,
          is_group: false,
          is_read: true,
          is_muted: false,
          is_archived: false,
          mode: 'ai', // Default to AI mode
          needs_human: false,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'session_id,remote_id', // Match the actual constraint name
          ignoreDuplicates: false
        }
      )
      .select()
      .single();

    if (chatError || !chatData) {
      console.error('Chat upsert error:', chatError);
      throw new Error('Failed to create/update chat');
    }

    const chatId = chatData.id;

    // Create message document with status 'pending'
    // The worker will pick it up and send it via Baileys
    const { data: message, error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: chatId,
        session_id: sessionId,
        remote_id: jid, // Add JID for worker to send via Baileys
        sender: 'agent',
        body: text,
        timestamp: new Date().toISOString(),
        is_from_us: true,
        media_type: null,
        media_url: null,
        status: 'pending', // Worker will change this to 'sent' after sending
      })
      .select()
      .single();

    if (messageError) {
      throw new Error('Failed to create message');
    }

    // Update chat's last message
    await supabaseAdmin
      .from('chats')
      .update({
        last_message: text,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId);

    return NextResponse.json({
      success: true,
      chatId,
      messageId: message.id,
      chat: chatData,
    });
  } catch (error: any) {
    console.error('Error in manual-send API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
