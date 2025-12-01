import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import * as admin from 'firebase-admin';
import pino from 'pino';

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Try to find credentials from environment or default
  try {
      // In many dev environments, this just works if gcloud auth is set up
      admin.initializeApp();
      console.log('Firebase Admin initialized successfully.');
  } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
      process.exit(1);
  }
}

const db = admin.firestore();
const sessions = new Map<string, any>();

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
            auth: state,
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
                    console.log(`Session ${sessionId} logged out.`);
                     try {
                        await db.collection('whatsappSessions').doc(sessionId).update({
                            isReady: false,
                            qr: '',
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });
                        // Optional: Delete auth folder
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
                    
                    // Extract text (simple version)
                    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';

                    const messageData = {
                        id: messageId,
                        text: text,
                        isFromMe: isFromMe,
                        timestamp: admin.firestore.Timestamp.fromMillis(timestamp),
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
        snapshot.docChanges().forEach((change) => {
            const sessionId = change.doc.id;
            const data = change.doc.data();

            if (change.type === 'added') {
                console.log(`New session detected: ${sessionId}`);
                startSession(sessionId);
            } 
            else if (change.type === 'modified') {
                 // If the user clicked Disconnect (isReady=false, qr='')
                 if (data.isReady === false && !data.qr && sessions.has(sessionId)) {
                     console.log(`Session ${sessionId} disconnected by user. Logging out.`);
                     const sock = sessions.get(sessionId);
                     sock.logout(); // This will clear creds and close connection
                     sessions.delete(sessionId);
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
