import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const { chatId, mode, sessionId } = await req.json();

    if (!chatId || !mode || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (mode !== 'ai' && mode !== 'human') {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "ai" or "human"' },
        { status: 400 }
      );
    }

    // Update chat mode in database
    const { data, error } = await supabaseAdmin
      .from('chats')
      .update({
        mode: mode,
        needs_human: mode === 'human',
      })
      .eq('id', chatId)
      .eq('session_id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating chat mode:', error);
      return NextResponse.json(
        { error: 'Failed to update chat mode', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, chat: data });
  } catch (error: any) {
    console.error('Error in toggle-mode API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
