import { makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, downloadMediaMessage } from '@whiskeysockets/baileys';
import * as admin from 'firebase-admin';
import pino from 'pino';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Try to find credentials from environment or default
  try {
      // In many dev environments, this just works if gcloud auth is set up
      admin.initializeApp({
          storageBucket: 'studio-5509266701-95460.appspot.com'
      });
      console.log('Firebase Admin initialized successfully.');
  } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
      process.exit(1);
  }
}

const db = admin.firestore();
const bucket = admin.storage().bucket();
const sessions = new Map<string, any>();

// Helper function to download and upload media
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

        // Generate unique filename
        const messageId = msg.key.id;
        const ext = mediaType === 'audio' ? 'ogg' : mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : mediaType === 'sticker' ? 'webp' : 'bin';
        const fileName = `media/${sessionId}/${messageId}.${ext}`;

        // Upload to Firebase Storage
        const file = bucket.file(fileName);
        await file.save(buffer as Buffer, {
            metadata: {
                contentType: mediaType === 'audio' ? 'audio/ogg' : mediaType === 'image' ? 'image/jpeg' : mediaType === 'video' ? 'video/mp4' : mediaType === 'sticker' ? 'image/webp' : 'application/octet-stream',
            },
            public: true,
        });

        // Get public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
        return publicUrl;
    } catch (error) {
        console.error('Error downloading/uploading media:', error);
        return null;
    }
}

async function startSession(sessionId: string) {
    if (sessions.has(sessionId)) {
        // If it's already running, we might want to check its status or just leave it.
        // For simplicity, let's leave it unless we implement a force restart mechanism.
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
            // Mobile API is often more stable for bots
             // browser: ['WaCRM', 'Chrome', '10.0.0'],
        });

        sessions.set(sessionId, sock);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log(`QR Code generated for session ${sessionId}`);
                try {
                    await db.collection('whatsappSessions').doc(sessionId).update({
                        qr: qr,
                        isReady: false,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                } catch (e) {
                    console.error(`Error updating QR for ${sessionId}:`, e);
                }
            }

            if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`Connection closed for ${sessionId}. Reconnecting: ${shouldReconnect}`);
                
                // Remove from memory map
                sessions.delete(sessionId);

                if (shouldReconnect) {
                    startSession(sessionId);
                } else {
                    console.log(`Session ${sessionId} logged out. Clearing all chats...`);
                     try {
                        // Delete all chats for this session
                        const chatsSnapshot = await db.collection('whatsappSessions').doc(sessionId).collection('chats').get();
                        const deletePromises = chatsSnapshot.docs.map(async (chatDoc) => {
                            // Delete all messages in this chat
                            const messagesSnapshot = await chatDoc.ref.collection('messages').get();
                            const messageDeletePromises = messagesSnapshot.docs.map(msgDoc => msgDoc.ref.delete());
                            await Promise.all(messageDeletePromises);
                            // Delete the chat itself
                            return chatDoc.ref.delete();
                        });
                        await Promise.all(deletePromises);
                        console.log(`Deleted all chats for logged out session ${sessionId}`);

                        await db.collection('whatsappSessions').doc(sessionId).update({
                            isReady: false,
                            qr: '',
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                     } catch (e) {
                         console.error(`Error updating logout status for ${sessionId}:`, e);
                     }
                }
            } else if (connection === 'open') {
                console.log(`Session ${sessionId} connected.`);
                try {
                    await db.collection('whatsappSessions').doc(sessionId).update({
                        isReady: true,
                        qr: '',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // Fetch and save existing chats after connection
                    console.log(`Fetching chats for session ${sessionId}...`);

                    // Fetch groups
                    try {
                        const groups = await sock.groupFetchAllParticipating();
                        const groupIds = Object.keys(groups);
                        console.log(`Found ${groupIds.length} group chats`);

                        for (const chatId of groupIds) {
                            const chat = groups[chatId];
                            try {
                                await db.collection('whatsappSessions').doc(sessionId).collection('chats').doc(chatId).set({
                                    id: chatId,
                                    remoteId: chatId,
                                    name: chat.subject || chat.id,
                                    unreadCount: 0,
                                    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
                                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                }, { merge: true });

                                // Messages will be loaded via messages.upsert event
                                // when they arrive or when the chat is opened in WhatsApp
                            } catch (e) {
                                console.error(`Error saving group chat ${chatId}:`, e);
                            }
                        }
                    } catch (e) {
                        console.log(`Could not fetch groups:`, e);
                    }

                    // Note: Individual chats will be created automatically when messages arrive
                    // via the messages.upsert and chats.upsert event handlers
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
                    
                    const messageId = msg.key.id;
                    if (!messageId) continue;
                    
                    const isFromMe = msg.key.fromMe || false;
                    const timestamp = typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Date.now();

                    // Extract message content based on type
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
                        // Download and upload media
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
                        text: text,
                        body: text,
                        isFromMe: isFromMe,
                        isFromUs: isFromMe,
                        chatId: chatId,
                        sessionId: sessionId,
                        mediaType: mediaType,
                        mediaUrl: mediaUrl,
                        status: 'delivered' as const,
                        timestamp: admin.firestore.Timestamp.fromMillis(timestamp),
                        createdAt: admin.firestore.Timestamp.fromMillis(timestamp),
                    };

                    try {
                        const chatRef = db.collection('whatsappSessions').doc(sessionId).collection('chats').doc(chatId);
                        const messageRef = chatRef.collection('messages').doc(messageId);

                        await messageRef.set(messageData, { merge: true });

                        // Update Chat metadata
                        await chatRef.set({
                            id: chatId,
                            remoteId: chatId,
                            lastMessage: text,
                            lastMessageAt: admin.firestore.Timestamp.fromMillis(timestamp),
                            // Increment unread count if it's not from me
                            unreadCount: isFromMe ? 0 : admin.firestore.FieldValue.increment(1),
                        }, { merge: true });

                        console.log(`Saved message ${messageId} to chat ${chatId}`);

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
                     await db.collection('whatsappSessions').doc(sessionId).collection('chats').doc(chatId).set({
                         id: chatId,
                         remoteId: chatId,
                         name: chat.name || null,
                         ...chat,
                         updatedAt: admin.firestore.FieldValue.serverTimestamp()
                     }, { merge: true });
                 } catch (e) {
                      console.error(`Error saving chat ${chatId}:`, e);
                 }
             }
        });

        sock.ev.on('contacts.upsert', async (contacts) => {
            console.log(`Received ${contacts.length} contacts for session ${sessionId}`);
             for (const contact of contacts) {
                 const contactId = contact.id;
                 if (!contactId) continue;
                 try {
                     // We might want to save contacts to a contacts collection or update chat names
                     // For now, let's just log or maybe update chat if exists
                 } catch (e) {
                      console.error(`Error saving contact ${contactId}:`, e);
                 }
             }
        });
        
    } catch (error) {
        console.error(`Error starting session ${sessionId}:`, error);
        sessions.delete(sessionId);
    }
}

console.log('Starting Worker...');

// Listen for outgoing messages
db.collectionGroup('messages')
    .where('status', '==', 'pending')
    .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            if (change.type === 'added') {
                const messageData = change.doc.data();
                const sessionId = messageData.sessionId;
                const chatId = messageData.chatId;
                const body = messageData.body;
                const messageId = change.doc.id;
                
                if (sessions.has(sessionId)) {
                    const sock = sessions.get(sessionId);
                    console.log(`Sending message ${messageId} to ${chatId}`);
                    try {
                        // Send message using the same ID
                        await sock.sendMessage(chatId, { text: body || '' }, { messageId: messageId });
                        
                        // Update status to sent
                        await change.doc.ref.update({
                            status: 'sent',
                            updatedAt: admin.firestore.FieldValue.serverTimestamp() 
                        });
                    } catch (e) {
                        console.error(`Error sending message ${messageId}:`, e);
                        await change.doc.ref.update({ status: 'failed' });
                    }
                }
            }
        });
    }, (error) => {
        console.error('Error listening to outgoing messages:', error);
    });


// Listen for session changes
db.collection('whatsappSessions').onSnapshot(
    (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const sessionId = change.doc.id;
            const data = change.doc.data();

            if (change.type === 'added') {
                console.log(`New session detected: ${sessionId}`);
                startSession(sessionId);
            }
            else if (change.type === 'modified') {
                 // If the user clicked Disconnect (shouldDisconnect flag)
                 if (data.shouldDisconnect && sessions.has(sessionId)) {
                     console.log(`Session ${sessionId} disconnected by user. Logging out and clearing chats...`);
                     const sock = sessions.get(sessionId);

                     try {
                         // Delete all chats for this session
                         const chatsSnapshot = await db.collection('whatsappSessions').doc(sessionId).collection('chats').get();
                         const deletePromises = chatsSnapshot.docs.map(async (chatDoc) => {
                             // Delete all messages in this chat
                             const messagesSnapshot = await chatDoc.ref.collection('messages').get();
                             const messageDeletePromises = messagesSnapshot.docs.map(msgDoc => msgDoc.ref.delete());
                             await Promise.all(messageDeletePromises);
                             // Delete the chat itself
                             return chatDoc.ref.delete();
                         });
                         await Promise.all(deletePromises);
                         console.log(`Deleted all chats for session ${sessionId}`);

                         // Logout from WhatsApp
                         sock.logout();
                         sessions.delete(sessionId);

                         // Reset the session document
                         await db.collection('whatsappSessions').doc(sessionId).update({
                             isReady: false,
                             qr: '',
                             shouldDisconnect: false,
                             updatedAt: admin.firestore.FieldValue.serverTimestamp()
                         });
                     } catch (e) {
                         console.error(`Error during disconnect cleanup for ${sessionId}:`, e);
                     }
                 }
                 else if (!sessions.has(sessionId)) {
                     startSession(sessionId);
                 }
            }
        });
    },
    (error) => {
        console.error('Error listening to whatsappSessions:', error);
    }
);

// Keep the process alive
process.on('SIGINT', () => {
    console.log('Shutting down...');
    sessions.forEach(sock => sock.end(undefined));
    process.exit(0);
});
