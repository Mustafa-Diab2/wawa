// Load environment variables from .env.local
import { config } from 'dotenv';
import path from 'path';
config({ path: path.join(process.cwd(), '.env.local') });

import { makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, downloadMediaMessage } from '@whiskeysockets/baileys';
import { supabaseAdmin } from './lib/supabaseAdmin';
import pino from 'pino';
import fs from 'fs';
import { callAI } from './lib/ai-agent';

const sessions = new Map<string, any>();

// Helper function to download and upload media (simplified for now - using external storage later)
async function downloadAndUploadMedia(msg: any, mediaType: string, sessionId: string): Promise<string | null> {
    try {
        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            {
                logger: pino({ level: 'silent' }) as any,
                reuploadRequest: () => Promise.resolve({} as any)
            }
        );

        if (!buffer) return null;

        // TODO: Upload to Supabase Storage
        // For now, return null and handle media later
        console.log(`Media download successful for ${mediaType}, upload to Supabase Storage coming soon`);
        return null;
    } catch (error) {
        console.error('Error downloading/uploading media:', error);
        return null;
    }
}

async function startSession(sessionId: string) {
    if (sessions.has(sessionId)) {
        return;
    }

    console.log(`Starting session manager for: ${sessionId}`);

    try {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { state, saveCreds } = await useMultiFileAuthState(`auth_info_baileys/${sessionId}`);

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }) as any),
            },
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }) as any,
        });

        sessions.set(sessionId, sock);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log(`QR Code generated for session ${sessionId}`);
                try {
                    await supabaseAdmin
                        .from('whatsapp_sessions')
                        .update({
                            qr: qr,
                            is_ready: false,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', sessionId);

                    console.log(`QR Code for session ${sessionId} successfully updated in Supabase.`);
                } catch (e) {
                    console.error(`Error updating QR for ${sessionId}:`, e);
                }
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`Connection closed for ${sessionId}. Reconnecting: ${shouldReconnect}`);

                sessions.delete(sessionId);

                if (shouldReconnect) {
                    startSession(sessionId);
                } else {
                    console.log(`Session ${sessionId} logged out. Clearing all chats...`);
                    try {
                        // Delete all chats and messages for this session
                        await supabaseAdmin
                            .from('chats')
                            .delete()
                            .eq('session_id', sessionId);

                        await supabaseAdmin
                            .from('messages')
                            .delete()
                            .eq('session_id', sessionId);

                        console.log(`Deleted all chats for logged out session ${sessionId}`);

                        await supabaseAdmin
                            .from('whatsapp_sessions')
                            .update({
                                is_ready: false,
                                qr: '',
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', sessionId);

                        console.log(`Session ${sessionId} logged out. Not restarting automatically to avoid loop.`);
                    } catch (e) {
                        console.error(`Error updating logout status for ${sessionId}:`, e);
                    }
                }
            } else if (connection === 'open') {
                console.log(`Session ${sessionId} connected.`);
                try {
                    await supabaseAdmin
                        .from('whatsapp_sessions')
                        .update({
                            is_ready: true,
                            qr: '',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', sessionId);

                    console.log(`Fetching chats for session ${sessionId}...`);

                    // Fetch groups
                    try {
                        const groups = await sock.groupFetchAllParticipating();
                        const groupIds = Object.keys(groups);
                        console.log(`Found ${groupIds.length} group chats`);

                        for (const chatId of groupIds) {
                            const chat = groups[chatId];
                            try {
                                await supabaseAdmin
                                    .from('chats')
                                    .upsert({
                                        id: chatId,
                                        session_id: sessionId,
                                        remote_id: chatId,
                                        name: chat.subject || chat.id,
                                        type: 'GROUP',
                                        is_group: true,
                                        last_message_at: new Date().toISOString(),
                                        updated_at: new Date().toISOString()
                                    }, {
                                        onConflict: 'id'
                                    });
                            } catch (e) {
                                console.error(`Error saving group chat ${chatId}:`, e);
                            }
                        }
                    } catch (e) {
                        console.log(`Could not fetch groups:`, e);
                    }

                    console.log(`Finished loading chats for session ${sessionId}`)
                } catch (e) {
                    console.error(`Error updating connected status for ${sessionId}:`, e);
                }
            }
        });

        sock.ev.on('creds.update', saveCreds);

        // Handle incoming messages
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type === 'notify' || type === 'append') {
                for (const msg of messages) {
                    if (!msg.message) continue;
                    const chatId = msg.key.remoteJid;
                    if (!chatId) continue;

                    // Ignore status broadcasts
                    if (chatId === 'status@broadcast') continue;

                    const messageId = msg.key.id;
                    if (!messageId) continue;

                    const isFromMe = msg.key.fromMe || false;
                    const timestamp = typeof msg.messageTimestamp === 'number' ? new Date(msg.messageTimestamp * 1000).toISOString() : new Date().toISOString();

                    // Extract message content
                    let text = '';
                    let mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker' | null = null;
                    let mediaUrl: string | null = null;

                    if (msg.message.conversation) {
                        text = msg.message.conversation;
                    } else if (msg.message.extendedTextMessage?.text) {
                        text = msg.message.extendedTextMessage.text;
                    } else if (msg.message.imageMessage) {
                        text = msg.message.imageMessage.caption || '📷 صورة';
                        mediaType = 'image';
                        mediaUrl = await downloadAndUploadMedia(msg, 'image', sessionId);
                    } else if (msg.message.videoMessage) {
                        text = msg.message.videoMessage.caption || '🎥 فيديو';
                        mediaType = 'video';
                        mediaUrl = await downloadAndUploadMedia(msg, 'video', sessionId);
                    } else if (msg.message.audioMessage) {
                        const isPtt = msg.message.audioMessage.ptt;
                        text = isPtt ? '🎤 رسالة صوتية' : '🎵 ملف صوتي';
                        mediaType = 'audio';
                        mediaUrl = await downloadAndUploadMedia(msg, 'audio', sessionId);
                    } else if (msg.message.stickerMessage) {
                        text = '🎨 ملصق';
                        mediaType = 'sticker';
                        mediaUrl = await downloadAndUploadMedia(msg, 'sticker', sessionId);
                    } else if (msg.message.documentMessage) {
                        const fileName = msg.message.documentMessage.fileName || 'ملف';
                        text = `📎 ${fileName}`;
                        mediaType = 'document';
                        mediaUrl = await downloadAndUploadMedia(msg, 'document', sessionId);
                    }

                    const messageData = {
                        id: messageId,
                        chat_id: chatId,
                        session_id: sessionId,
                        remote_id: chatId,
                        sender: isFromMe ? 'me' : chatId,
                        body: text,
                        timestamp: timestamp,
                        is_from_us: isFromMe,
                        media_type: mediaType,
                        media_url: mediaUrl,
                        status: 'delivered' as const,
                        created_at: timestamp,
                    };

                    try {
                        // Insert message
                        await supabaseAdmin
                            .from('messages')
                            .upsert(messageData, {
                                onConflict: 'id'
                            });

                        // Update or create chat
                        await supabaseAdmin
                            .from('chats')
                            .upsert({
                                id: chatId,
                                session_id: sessionId,
                                remote_id: chatId,
                                name: chatId.split('@')[0],
                                type: 'INDIVIDUAL',
                                last_message: text,
                                last_message_at: timestamp,
                                is_unread: !isFromMe,
                                updated_at: new Date().toISOString()
                            }, {
                                onConflict: 'id'
                            });

                        console.log(`Saved message ${messageId} to chat ${chatId}`);

                        // AI Agent Logic - Only for incoming messages (not from us)
                        if (!isFromMe && text && text.trim() !== '') {
                            try {
                                // Get chat data
                                const { data: chatData } = await supabaseAdmin
                                    .from('chats')
                                    .select('*')
                                    .eq('id', chatId)
                                    .single();

                                // If chat doesn't exist or doesn't have mode field, create/update it
                                if (!chatData || !chatData.mode) {
                                    console.log(`[AI] Creating/updating chat ${chatId} with AI mode`);
                                    await supabaseAdmin
                                        .from('chats')
                                        .upsert({
                                            id: chatId,
                                            session_id: sessionId,
                                            remote_id: chatId,
                                            name: chatId.split('@')[0],
                                            type: 'INDIVIDUAL',
                                            status: 'INBOX',
                                            last_message: text,
                                            last_message_at: timestamp,
                                            assigned_to: null,
                                            is_group: false,
                                            is_read: false,
                                            is_muted: false,
                                            is_archived: false,
                                            mode: 'ai',
                                            needs_human: false,
                                            created_at: new Date().toISOString(),
                                            updated_at: new Date().toISOString(),
                                        }, {
                                            onConflict: 'id'
                                        });
                                }

                                // Re-fetch to get updated data
                                const { data: updatedChatData } = await supabaseAdmin
                                    .from('chats')
                                    .select('*')
                                    .eq('id', chatId)
                                    .single();

                                // Check chat mode
                                if (updatedChatData?.mode === 'human') {
                                    console.log(`[AI] Chat ${chatId} is in human mode, skipping AI`);
                                } else {
                                    // Mode is 'ai' - call AI agent
                                    console.log(`[AI] Chat ${chatId} is in AI mode, calling AI agent...`);

                                    // Get conversation history (last 5 messages)
                                    const { data: messagesHistory } = await supabaseAdmin
                                        .from('messages')
                                        .select('*')
                                        .eq('chat_id', chatId)
                                        .order('timestamp', { ascending: false })
                                        .limit(6);

                                    const conversationHistory = (messagesHistory || [])
                                        .reverse()
                                        .slice(0, -1)
                                        .map((msg: any) => ({
                                            role: msg.is_from_us ? ('assistant' as const) : ('user' as const),
                                            content: msg.body || '',
                                        }))
                                        .filter((m) => m.content.trim() !== '');

                                    // Call AI
                                    const aiResponse = await callAI(conversationHistory, text);

                                    // Send reply via WhatsApp
                                    await sock.sendMessage(chatId, { text: aiResponse.reply });
                                    console.log(`[AI] Sent reply to ${chatId}`);

                                    // Save AI message to Supabase
                                    const aiMessageId = `ai_${Date.now()}`;
                                    await supabaseAdmin
                                        .from('messages')
                                        .insert({
                                            id: aiMessageId,
                                            chat_id: chatId,
                                            session_id: sessionId,
                                            remote_id: chatId,
                                            sender: 'bot',
                                            body: aiResponse.reply,
                                            timestamp: new Date().toISOString(),
                                            created_at: new Date().toISOString(),
                                            is_from_us: true,
                                            media_type: null,
                                            media_url: null,
                                            status: 'sent',
                                        });

                                    // Update chat's last message
                                    await supabaseAdmin
                                        .from('chats')
                                        .update({
                                            last_message: aiResponse.reply,
                                            last_message_at: new Date().toISOString(),
                                        })
                                        .eq('id', chatId);

                                    // Handle handoff if requested
                                    if (aiResponse.handoff) {
                                        console.log(`[AI] Handoff requested for chat ${chatId}: ${aiResponse.handoff_reason}`);

                                        await supabaseAdmin
                                            .from('chats')
                                            .update({
                                                mode: 'human',
                                                needs_human: true,
                                                updated_at: new Date().toISOString(),
                                            })
                                            .eq('id', chatId);

                                        console.log(`[AI] Chat ${chatId} switched to human mode`);
                                    }
                                }
                            } catch (aiError) {
                                console.error(`[AI] Error processing AI for chat ${chatId}:`, aiError);
                            }
                        }

                    } catch (e) {
                        console.error(`Error saving message for ${sessionId}:`, e);
                    }
                }
            }
        });

        // Handle chats
        sock.ev.on('chats.upsert', async (chats) => {
            console.log(`Received ${chats.length} chats for session ${sessionId}`);
            for (const chat of chats) {
                const chatId = chat.id;
                if (!chatId) continue;
                try {
                    await supabaseAdmin
                        .from('chats')
                        .upsert({
                            id: chatId,
                            session_id: sessionId,
                            remote_id: chatId,
                            name: chat.name || null,
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: 'id'
                        });
                } catch (e) {
                    console.error(`Error saving chat ${chatId}:`, e);
                }
            }
        });

    } catch (error) {
        console.error(`Error starting session ${sessionId}:`, error);
        sessions.delete(sessionId);
    }
}

console.log('Starting Worker with Supabase...');

// Listen for outgoing messages using Supabase Realtime
supabaseAdmin
    .channel('messages-channel')
    .on(
        'postgres_changes',
        {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: 'status=eq.pending'
        },
        async (payload) => {
            const messageData = payload.new;
            const sessionId = messageData.session_id;
            const remoteId = messageData.remote_id;
            const body = messageData.body;
            const messageId = messageData.id;

            if (sessions.has(sessionId)) {
                const sock = sessions.get(sessionId);
                console.log(`[Worker] Sending message ${messageId} to ${remoteId}`);
                try {
                    await sock.sendMessage(remoteId, { text: body || '' });

                    await supabaseAdmin
                        .from('messages')
                        .update({
                            status: 'sent',
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', messageId);

                    console.log(`[Worker] ✅ Message ${messageId} sent successfully`);
                } catch (e) {
                    console.error(`[Worker] ❌ Error sending message ${messageId}:`, e);
                    await supabaseAdmin
                        .from('messages')
                        .update({ status: 'failed' })
                        .eq('id', messageId);
                }
            } else {
                console.warn(`[Worker] ⚠️ Session ${sessionId} not found in active sessions`);
            }
        }
    )
    .subscribe();

// Polling function to check for new sessions every 5 seconds
console.log('[Worker] Setting up polling for new sessions (every 5 seconds)...');
setInterval(async () => {
    try {
        const { data: allSessions, error } = await supabaseAdmin
            .from('whatsapp_sessions')
            .select('*');

        if (error) {
            console.error('[Polling] Error fetching sessions:', error);
            return;
        }

        if (!allSessions) return;

        for (const sessionData of allSessions) {
            const sessionId = sessionData.id;

            // Check if session should disconnect
            if (sessionData.should_disconnect && sessions.has(sessionId)) {
                console.log(`[Polling] Session ${sessionId} should disconnect`);
                const sock = sessions.get(sessionId);

                try {
                    // Delete all chats and messages
                    await supabaseAdmin
                        .from('chats')
                        .delete()
                        .eq('session_id', sessionId);

                    await supabaseAdmin
                        .from('messages')
                        .delete()
                        .eq('session_id', sessionId);

                    console.log(`Deleted all chats for session ${sessionId}`);

                    // Delete auth state files
                    const authPath = path.join(process.cwd(), 'auth_info_baileys', sessionId);
                    try {
                        if (fs.existsSync(authPath)) {
                            fs.rmSync(authPath, { recursive: true, force: true });
                            console.log(`✅ Deleted auth state for session ${sessionId}`);
                        }
                    } catch (err) {
                        console.error(`❌ Error deleting auth state for session ${sessionId}:`, err);
                    }

                    // Reset the session document
                    await supabaseAdmin
                        .from('whatsapp_sessions')
                        .update({
                            is_ready: false,
                            qr: '',
                            should_disconnect: false,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', sessionId);

                    console.log(`Logging out session ${sessionId}...`);
                    sock.logout();
                    sessions.delete(sessionId);
                } catch (e) {
                    console.error(`Error during disconnect cleanup for ${sessionId}:`, e);
                }
            }
            // Start session if not already started
            else if (!sessions.has(sessionId)) {
                console.log(`[Polling] ✅ New session detected: ${sessionId}`);
                startSession(sessionId);
            }
        }
    } catch (e) {
        console.error('[Polling] Error in polling loop:', e);
    }
}, 5000);

// Load existing sessions on startup
(async () => {
    console.log('[Worker] Querying existing sessions from whatsapp_sessions table...');
    const { data: existingSessions, error } = await supabaseAdmin
        .from('whatsapp_sessions')
        .select('id');

    if (error) {
        console.error('[Worker] ❌ Error querying sessions:', error);
    } else if (existingSessions) {
        console.log(`[Worker] ✅ Found ${existingSessions.length} existing sessions:`, existingSessions);
        for (const session of existingSessions) {
            console.log(`[Worker] Starting session from DB: ${session.id}`);
            startSession(session.id);
        }
    } else {
        console.log('[Worker] No existing sessions found in database');
    }
})();

// Keep the process alive
process.on('SIGINT', () => {
    console.log('Shutting down...');
    sessions.forEach(sock => sock.end(undefined));
    process.exit(0);
});
