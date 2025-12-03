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

    if (!session.is_ready) {
      return NextResponse.json(
        { error: 'WhatsApp not connected. Please connect first.' },
        { status: 400 }
      );
    }

    // Normalize JID (should already be in format: 201234567890@s.whatsapp.net)
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    // Create or get existing chat
    const { data: existingChats } = await supabaseAdmin
      .from('chats')
      .select('*')
      .eq('session_id', sessionId)
      .eq('remote_id', jid)
      .limit(1);

    let chatId: string;
    let chatData: any;

    if (existingChats && existingChats.length > 0) {
      chatData = existingChats[0];
      chatId = chatData.id;
    } else {
      // Create new chat
      const { data: newChat, error: chatError } = await supabaseAdmin
        .from('chats')
        .insert({
          session_id: sessionId,
          remote_id: jid,
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
        })
        .select()
        .single();

      if (chatError || !newChat) {
        throw new Error('Failed to create chat');
      }

      chatData = newChat;
      chatId = newChat.id;
    }

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
