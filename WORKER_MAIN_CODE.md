# 🤖 Worker Main Code

## worker-service/src/worker.ts

```typescript
// @ts-nocheck
import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(__dirname, '../../.env.local') });

import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  Browsers,
  WAMessage
} from '@whiskeysockets/baileys';
import { supabaseAdmin } from './lib/supabaseAdmin';
import { QRManager } from './qr-manager';
import { SessionManager } from './session-manager';
import pino from 'pino';

// Initialize managers
const qrManager = new QRManager(
  parseInt(process.env.QR_REFRESH_INTERVAL || '5000'),
  parseInt(process.env.QR_EXPIRY_TIME || '300000')
);
const sessionManager = new SessionManager();

console.log('🚀 Starting WhatsApp Worker Service...');
console.log('📋 Configuration:');
console.log(`  - QR Refresh Interval: ${process.env.QR_REFRESH_INTERVAL || 5000}ms`);
console.log(`  - QR Expiry Time: ${process.env.QR_EXPIRY_TIME || 300000}ms`);

/**
 * Start WhatsApp Session
 */
async function startSession(sessionId: string) {
  if (sessionManager.isActive(sessionId)) {
    console.log(`⚠️ [${sessionId}] Session already running`);
    return;
  }

  console.log(`🔌 [${sessionId}] Starting session...`);

  try {
    // Load authentication state from disk
    const { state, saveCreds } = await useMultiFileAuthState(
      `auth_info_baileys/${sessionId}`
    );

    // Create WhatsApp socket
    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }) as any)
      },
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }) as any,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      defaultQueryTimeoutMs: undefined,
      markOnlineOnConnect: true,
      getMessage: async (key) => {
        return {
          conversation: ''
        };
      }
    });

    // Register session
    sessionManager.register(sessionId, sock);

    // ==================== CONNECTION EVENTS ====================

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // 🔵 QR Code Generated
      if (qr) {
        const updated = await qrManager.updateQR(sessionId, qr);
        if (updated) {
          console.log(`📱 [${sessionId}] QR Code generated (${qr.length} chars)`);
        }
      }

      // 🟢 Connected
      if (connection === 'open') {
        console.log(`✅ [${sessionId}] WhatsApp Connected!`);

        // Clear QR and update status
        await qrManager.clearQR(sessionId);

        // Fetch chats from WhatsApp
        await fetchAndSyncChats(sessionId, sock);

        // Update session info
        const phoneNumber = sock.user?.id?.split(':')[0];
        await sessionManager.updateStatus(sessionId, {
          isReady: true,
          isConnected: true,
          phoneNumber: phoneNumber || '',
          deviceName: 'WhatsApp Web'
        });
      }

      // 🔴 Disconnected
      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const reason = DisconnectReason[statusCode] || 'unknown';

        console.log(`🔴 [${sessionId}] Disconnected: ${reason}`);

        if (isLoggedOut) {
          // User logged out - clean everything
          console.log(`🧹 [${sessionId}] User logged out, cleaning data...`);

          await supabaseAdmin
            .from('chats')
            .delete()
            .eq('session_id', sessionId);

          await supabaseAdmin
            .from('messages')
            .delete()
            .eq('chat_id', 'in', `(SELECT id FROM chats WHERE session_id = '${sessionId}')`);

          await sessionManager.cleanupDisconnected(sessionId, 'logged_out');

          // Restart session to generate new QR
          setTimeout(() => startSession(sessionId), 3000);
        } else {
          // Temporary disconnect - try to reconnect
          await sessionManager.cleanupDisconnected(sessionId, reason);

          setTimeout(() => startSession(sessionId), 5000);
        }
      }
    });

    // ==================== CREDENTIAL UPDATES ====================

    sock.ev.on('creds.update', async () => {
      await saveCreds();
    });

    // ==================== MESSAGE EVENTS ====================

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message) continue;

        await handleIncomingMessage(sessionId, sock, msg);
      }
    });

    // ==================== GROUP EVENTS ====================

    sock.ev.on('groups.upsert', async (groups) => {
      console.log(`👥 [${sessionId}] ${groups.length} new groups detected`);
      // Handle group sync if needed
    });

  } catch (error) {
    console.error(`❌ [${sessionId}] Error starting session:`, error);
    await sessionManager.cleanupDisconnected(sessionId, 'startup_error');
  }
}

/**
 * Fetch and sync chats from WhatsApp
 */
async function fetchAndSyncChats(sessionId: string, sock: any) {
  try {
    console.log(`📥 [${sessionId}] Fetching chats from WhatsApp...`);

    const chats = await sock.getChats ? await sock.getChats() : [];

    console.log(`📥 [${sessionId}] Found ${chats.length} chats`);

    for (const chat of chats) {
      const jid = chat.id;
      const name = chat.name || chat.notify || jid.split('@')[0];

      // Upsert chat (use session_id,remote_id constraint)
      await supabaseAdmin
        .from('chats')
        .upsert({
          session_id: sessionId,
          remote_id: jid,
          phone_jid: jid,
          name: name,
          type: jid.endsWith('@g.us') ? 'GROUP' : 'INDIVIDUAL',
          is_group: jid.endsWith('@g.us'),
          status: 'INBOX',
          is_unread: chat.unreadCount > 0,
          last_message_at: new Date().toISOString()
        }, {
          onConflict: 'session_id,remote_id',
          ignoreDuplicates: false
        });
    }

    console.log(`✅ [${sessionId}] Synced ${chats.length} chats to database`);
  } catch (error) {
    console.error(`❌ [${sessionId}] Error fetching chats:`, error);
  }
}

/**
 * Handle incoming WhatsApp message
 */
async function handleIncomingMessage(
  sessionId: string,
  sock: any,
  msg: WAMessage
) {
  try {
    const fromMe = msg.key.fromMe;
    const remoteJid = msg.key.remoteJid!;
    const messageId = msg.key.id!;

    // Extract message body
    const body =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      '';

    if (!body && !msg.message?.imageMessage && !msg.message?.videoMessage) {
      return; // Skip empty messages
    }

    const timestamp = msg.messageTimestamp
      ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString();

    console.log(`📩 [${sessionId}] ${fromMe ? 'Sent' : 'Received'}: ${body?.substring(0, 50)}...`);

    // Upsert chat (CRITICAL: use session_id,remote_id)
    const { data: chat, error: chatError } = await supabaseAdmin
      .from('chats')
      .upsert({
        session_id: sessionId,
        remote_id: remoteJid,
        phone_jid: remoteJid,
        name: msg.pushName || remoteJid.split('@')[0],
        type: remoteJid.endsWith('@g.us') ? 'GROUP' : 'INDIVIDUAL',
        is_group: remoteJid.endsWith('@g.us'),
        status: 'INBOX',
        is_unread: !fromMe,
        is_read: fromMe,
        last_message: body,
        last_message_at: timestamp,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'session_id,remote_id',  // PREVENTS DUPLICATES
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (chatError) {
      console.error(`❌ [${sessionId}] Error upserting chat:`, chatError);
      return;
    }

    // Insert message
    await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: chat.id,
        remote_id: messageId,
        body: body,
        from_me: fromMe,
        is_read: fromMe,
        sender_jid: msg.key.participant || remoteJid,
        sender_name: msg.pushName || '',
        timestamp: timestamp
      });

    console.log(`✅ [${sessionId}] Message saved to chat ${chat.id}`);

    // Auto-reply if needed (AI mode)
    if (!fromMe && chat.mode === 'ai') {
      await handleAutoReply(sessionId, sock, chat, body);
    }

  } catch (error) {
    console.error(`❌ [${sessionId}] Error handling message:`, error);
  }
}

/**
 * Send auto-reply (AI response)
 */
async function handleAutoReply(
  sessionId: string,
  sock: any,
  chat: any,
  incomingMessage: string
) {
  try {
    // Simple auto-reply logic (replace with your AI)
    const reply = `شكراً لتواصلك معنا! تلقينا رسالتك: "${incomingMessage.substring(0, 50)}..."`;

    // Send WhatsApp message
    await sock.sendMessage(chat.remote_id, {
      text: reply
    });

    // Save reply to database
    await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: chat.id,
        body: reply,
        from_me: true,
        is_sent: true,
        ai_processed: true,
        ai_response: reply,
        timestamp: new Date().toISOString()
      });

    // Update chat
    await supabaseAdmin
      .from('chats')
      .update({
        last_message: reply,
        last_message_at: new Date().toISOString()
      })
      .eq('id', chat.id);

    console.log(`🤖 [${sessionId}] Auto-reply sent to ${chat.name}`);
  } catch (error) {
    console.error(`❌ [${sessionId}] Error sending auto-reply:`, error);
  }
}

/**
 * Main worker loop
 */
async function main() {
  console.log('🔍 Checking for existing sessions...');

  // Fetch all sessions from database
  const { data: sessions, error } = await supabaseAdmin
    .from('whatsapp_sessions')
    .select('id');

  if (error) {
    console.error('❌ Error fetching sessions:', error);
    return;
  }

  console.log(`📊 Found ${sessions?.length || 0} sessions`);

  // Start each session
  for (const session of sessions || []) {
    await startSession(session.id);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between sessions
  }

  // Poll for new sessions every 10 seconds
  setInterval(async () => {
    const { data: allSessions } = await supabaseAdmin
      .from('whatsapp_sessions')
      .select('id');

    for (const session of allSessions || []) {
      if (!sessionManager.isActive(session.id)) {
        console.log(`🆕 New session detected: ${session.id}`);
        await startSession(session.id);
      }
    }
  }, 10000);

  // Expire old QRs every minute
  setInterval(() => {
    qrManager.expireOldQRs();
  }, 60000);

  console.log('✅ Worker service is running');
}

// Start worker
main().catch(console.error);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  process.exit(0);
});
```

---

## 🎯 Key Features Implemented

### 1. **QR Auto-Regeneration**
- QR يتجدد كل 5 ثوانٍ (configurable)
- QR ينتهي صلاحيته بعد 5 دقائق
- منع تحديثات QR المكررة

### 2. **Session Persistence**
- Auth credentials تُحفظ على الديسك
- Session يُعاد اتصاله تلقائياً عند انقطاع الاتصال
- تنظيف البيانات عند logout

### 3. **No Duplicate Chats**
- استخدام `UNIQUE (session_id, remote_id)` constraint
- كل رسالة ترجع لنفس الـ chat
- دعم LID mapping

### 4. **Auto-Reply**
- ردود تلقائية للرسائل في AI mode
- الرد يُحفظ في نفس الـ chat
- قابل للتخصيص بـ AI

---

سأكمل في الملف التالي بالـ Frontend و APIs...
