import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isPhoneJid, isLidJid } from '@/lib/phone-utils';

/**
 * API to merge duplicate chats caused by LID/Phone mismatch
 * This finds chats that appear to be for the same contact and merges them
 *
 * POST /api/chats/merge-duplicates
 * Body: { sessionId: string, dryRun?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, dryRun = true } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required field: sessionId' },
        { status: 400 }
      );
    }

    // Find all chats for this session
    const { data: chats, error: chatsError } = await supabaseAdmin
      .from('chats')
      .select('*')
      .eq('session_id', sessionId)
      .eq('type', 'INDIVIDUAL')
      .order('created_at', { ascending: true });

    if (chatsError || !chats) {
      return NextResponse.json(
        { error: 'Failed to fetch chats', details: chatsError },
        { status: 500 }
      );
    }

    // Separate chats into phone-based and LID-based
    const phoneChats = chats.filter(c => isPhoneJid(c.remote_id));
    const lidChats = chats.filter(c => isLidJid(c.remote_id));

    console.log(`[merge-duplicates] Found ${phoneChats.length} phone chats, ${lidChats.length} LID chats`);

    const mergeOperations: Array<{
      phoneChat: any;
      lidChat: any;
      action: string;
    }> = [];

    // For each LID chat, check if there's a phone chat that might be the same contact
    // We can match by:
    // 1. phone_jid field if set
    // 2. name similarity
    // 3. Recent message patterns

    for (const lidChat of lidChats) {
      // If this LID chat already has phone_jid, try to find matching phone chat
      if (lidChat.phone_jid) {
        const matchingPhoneChat = phoneChats.find(
          pc => pc.remote_id === lidChat.phone_jid || pc.phone_jid === lidChat.phone_jid
        );

        if (matchingPhoneChat && matchingPhoneChat.id !== lidChat.id) {
          mergeOperations.push({
            phoneChat: matchingPhoneChat,
            lidChat: lidChat,
            action: 'merge_by_phone_jid'
          });
        }
      }
    }

    // Also check for phone chats that might match LID chats by examining if they were
    // created around the same time and have similar patterns
    for (const phoneChat of phoneChats) {
      // Skip if already in merge operations
      if (mergeOperations.some(op => op.phoneChat.id === phoneChat.id)) continue;

      // Check if there's a LID chat that was updated after this phone chat was created
      // and both have the same phone number pattern
      const phoneNumber = phoneChat.remote_id.split('@')[0];

      for (const lidChat of lidChats) {
        // Skip if already in merge operations
        if (mergeOperations.some(op => op.lidChat.id === lidChat.id)) continue;

        // If the LID chat's name contains the phone number, it's likely a match
        if (lidChat.name && lidChat.name.includes(phoneNumber.slice(-4))) {
          mergeOperations.push({
            phoneChat: phoneChat,
            lidChat: lidChat,
            action: 'merge_by_name_pattern'
          });
        }
      }
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        message: 'Dry run completed. Set dryRun=false to execute merge.',
        stats: {
          totalChats: chats.length,
          phoneChats: phoneChats.length,
          lidChats: lidChats.length,
          potentialMerges: mergeOperations.length
        },
        mergeOperations: mergeOperations.map(op => ({
          phoneChatId: op.phoneChat.id,
          phoneChatRemoteId: op.phoneChat.remote_id,
          lidChatId: op.lidChat.id,
          lidChatRemoteId: op.lidChat.remote_id,
          action: op.action
        }))
      });
    }

    // Execute merge operations
    const results = [];

    for (const op of mergeOperations) {
      try {
        // The strategy: Keep the LID chat (as that's what WhatsApp uses now)
        // and merge messages from phone chat into it

        // 1. Update all messages from phone chat to point to LID chat
        const { error: messagesError } = await supabaseAdmin
          .from('messages')
          .update({ chat_id: op.lidChat.id })
          .eq('chat_id', op.phoneChat.id);

        if (messagesError) {
          results.push({
            ...op,
            success: false,
            error: 'Failed to migrate messages',
            details: messagesError
          });
          continue;
        }

        // 2. Update LID chat with phone_jid from phone chat
        await supabaseAdmin
          .from('chats')
          .update({
            phone_jid: op.phoneChat.remote_id,
            name: op.phoneChat.name || op.lidChat.name, // Prefer phone chat name
            updated_at: new Date().toISOString()
          })
          .eq('id', op.lidChat.id);

        // 3. Delete the phone chat (now empty)
        await supabaseAdmin
          .from('chats')
          .delete()
          .eq('id', op.phoneChat.id);

        results.push({
          phoneChatId: op.phoneChat.id,
          lidChatId: op.lidChat.id,
          success: true,
          action: op.action
        });

        console.log(`[merge-duplicates] Merged ${op.phoneChat.id} into ${op.lidChat.id}`);
      } catch (error) {
        results.push({
          ...op,
          success: false,
          error: 'Unexpected error during merge',
          details: error
        });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      message: 'Merge completed',
      results
    });
  } catch (error: any) {
    console.error('Error in merge-duplicates API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check for duplicate chats
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required param: sessionId' },
        { status: 400 }
      );
    }

    // Find all chats for this session
    const { data: chats, error: chatsError } = await supabaseAdmin
      .from('chats')
      .select('id, remote_id, phone_jid, name, type, created_at, last_message_at')
      .eq('session_id', sessionId)
      .eq('type', 'INDIVIDUAL')
      .order('created_at', { ascending: true });

    if (chatsError || !chats) {
      return NextResponse.json(
        { error: 'Failed to fetch chats', details: chatsError },
        { status: 500 }
      );
    }

    // Categorize chats
    const analysis = chats.map(chat => ({
      id: chat.id,
      remote_id: chat.remote_id,
      phone_jid: chat.phone_jid,
      name: chat.name,
      isPhone: isPhoneJid(chat.remote_id),
      isLid: isLidJid(chat.remote_id),
      created_at: chat.created_at,
      last_message_at: chat.last_message_at
    }));

    return NextResponse.json({
      success: true,
      totalChats: chats.length,
      phoneChats: analysis.filter(c => c.isPhone).length,
      lidChats: analysis.filter(c => c.isLid).length,
      chats: analysis
    });
  } catch (error: any) {
    console.error('Error in merge-duplicates GET:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
