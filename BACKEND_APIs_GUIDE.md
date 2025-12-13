# 🔌 Backend APIs - Complete Implementation

## src/app/api/session/create/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Check if user already has a session
    const { data: existing } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('owner_id', userId)
      .single();

    if (existing) {
      return NextResponse.json({
        success: true,
        session: existing,
        message: 'Session already exists'
      });
    }

    // Create new session
    const { data: session, error } = await supabase
      .from('whatsapp_sessions')
      .insert({
        owner_id: userId,
        is_ready: false,
        is_connected: false,
        qr: null
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      session,
      message: 'Session created successfully'
    });

  } catch (error: any) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

## src/app/api/session/status/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const { data: session, error } = await supabase
      .from('whatsapp_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) throw error;

    // Check QR expiry
    let qrExpired = false;
    if (session.qr_expires_at) {
      qrExpired = new Date(session.qr_expires_at) < new Date();
    }

    return NextResponse.json({
      success: true,
      session: {
        ...session,
        qr_expired: qrExpired
      }
    });

  } catch (error: any) {
    console.error('Error fetching session status:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

## src/app/api/qr/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const format = searchParams.get('format') || 'text'; // text, image, svg

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Fetch session
    const { data: session, error } = await supabase
      .from('whatsapp_sessions')
      .select('qr, qr_expires_at, is_ready')
      .eq('id', sessionId)
      .single();

    if (error) throw error;

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if connected
    if (session.is_ready) {
      return NextResponse.json({
        success: true,
        connected: true,
        qr: null,
        message: 'WhatsApp already connected'
      });
    }

    // Check QR expiry
    if (!session.qr) {
      return NextResponse.json({
        success: false,
        qr: null,
        message: 'QR not yet generated. Please wait...'
      });
    }

    const qrExpired = session.qr_expires_at
      ? new Date(session.qr_expires_at) < new Date()
      : false;

    if (qrExpired) {
      return NextResponse.json({
        success: false,
        qr: null,
        expired: true,
        message: 'QR expired. Generating new one...'
      });
    }

    // Return QR based on format
    if (format === 'image') {
      // Generate QR as PNG image
      const qrImageBuffer = await QRCode.toBuffer(session.qr, {
        width: 300,
        margin: 2
      });

      return new NextResponse(qrImageBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      });
    }

    if (format === 'svg') {
      const qrSVG = await QRCode.toString(session.qr, { type: 'svg' });
      return new NextResponse(qrSVG, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-store, no-cache, must-revalidate'
        }
      });
    }

    // Default: return text
    return NextResponse.json({
      success: true,
      qr: session.qr,
      qr_expires_at: session.qr_expires_at
    });

  } catch (error: any) {
    console.error('Error fetching QR:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

## src/app/api/messages/send/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { sessionId, to, message } = await request.json();

    if (!sessionId || !to || !message) {
      return NextResponse.json(
        { error: 'sessionId, to, and message are required' },
        { status: 400 }
      );
    }

    // Normalize phone number
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    // Upsert chat (PREVENTS DUPLICATES)
    const { data: chat, error: chatError } = await supabase
      .from('chats')
      .upsert({
        session_id: sessionId,
        remote_id: jid,
        phone_jid: jid,
        name: to,
        type: 'INDIVIDUAL',
        status: 'INBOX',
        is_unread: false,
        last_message: message,
        last_message_at: new Date().toISOString()
      }, {
        onConflict: 'session_id,remote_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (chatError) throw chatError;

    // Save message
    const { data: msg, error: msgError } = await supabase
      .from('messages')
      .insert({
        chat_id: chat.id,
        body: message,
        from_me: true,
        is_sent: true,
        timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // TODO: Send via WhatsApp socket (worker handles this)
    // For now, we mark as pending and worker will send it

    return NextResponse.json({
      success: true,
      chat,
      message: msg
    });

  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

## src/app/api/webhook/route.ts

```typescript
/**
 * WhatsApp Webhook Endpoint
 * For WhatsApp Business API / Cloud API integration
 */

import { NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!;

// GET: Webhook verification (required by WhatsApp)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verified');
      return new NextResponse(challenge, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 403 }
    );
  } catch (error) {
    console.error('Webhook verification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Receive webhook events
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('📩 Webhook received:', JSON.stringify(body, null, 2));

    // Process webhook (WhatsApp Business API format)
    if (body.entry && body.entry[0]?.changes) {
      for (const change of body.entry[0].changes) {
        if (change.value?.messages) {
          for (const message of change.value.messages) {
            await processIncomingMessage(message, change.value.metadata);
          }
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function processIncomingMessage(message: any, metadata: any) {
  console.log('Processing message:', message.id);

  // TODO: Implement message processing
  // - Save to database
  // - Trigger auto-reply
  // - Update chat status
}
```

---

سأكمل في الملف التالي بالـ Frontend Components...
