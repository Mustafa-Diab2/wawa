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
        
    } catch (error) {
        console.error(`Error starting session ${sessionId}:`, error);
        sessions.delete(sessionId);
    }
}

console.log('Starting Worker...');

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
                 // If the user cleared the QR (requested refresh) and we are not ready, 
                 // and we are NOT running (checked by has), we start.
                 // But if we ARE running, maybe we need to restart?
                 
                 // If data.qr is empty and data.isReady is false, and we have a session running...
                 // It might be that the running session is stale.
                 
                 if (!sessions.has(sessionId)) {
                     startSession(sessionId);
                 } else {
                     // Check if we need to force restart
                     // For now, let's keep it simple.
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
