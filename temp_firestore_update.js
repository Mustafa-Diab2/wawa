// temp_firestore_update.js
const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

if (!admin.apps.length) {
  try {
      const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (serviceAccountPath) {
          const serviceAccount = require(serviceAccountPath);
          admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: 'studio-5509266701-95460'
          });
          console.log('Firebase Admin initialized successfully using GOOGLE_APPLICATION_CREDENTIALS.');
      } else {
          admin.initializeApp({
              projectId: 'studio-5509266701-95460'
          });
          console.log('Firebase Admin initialized successfully using default credentials.');
      }
  } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
      process.exit(1);
  }
}

const db = admin.firestore();

async function simulateDisconnect(sessionId) {
    console.log(`Simulating disconnect for session: ${sessionId}`);
    const sessionDocRef = db.collection('whatsappSessions').doc(sessionId);
    try {
        await sessionDocRef.update({
            qr: '',
            isReady: false,
            shouldDisconnect: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Firestore document for ${sessionId} updated to simulate disconnect.`);
    } catch (error) {
        console.error(`Error simulating disconnect for ${sessionId}:`, error);
    }
    process.exit(0);
}

async function simulateRefresh(sessionId) {
    console.log(`Simulating refresh for session: ${sessionId}`);
    const sessionDocRef = db.collection('whatsappSessions').doc(sessionId);
    try {
        await sessionDocRef.update({
            qr: '',
            isReady: false,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Firestore document for ${sessionId} updated to simulate refresh.`);
    } catch (error) {
        console.error(`Error simulating refresh for ${sessionId}:`, error);
    }
    process.exit(0);
}

const action = process.argv[2]; // 'disconnect' or 'refresh'
const sessionId = process.argv[3]; // The session ID

if (!action || !sessionId) {
    console.error('Usage: node temp_firestore_update.js <action> <sessionId>');
    process.exit(1);
}

if (action === 'disconnect') {
    simulateDisconnect(sessionId);
} else if (action === 'refresh') {
    simulateRefresh(sessionId);
} else {
    console.error('Invalid action. Use "disconnect" or "refresh".');
    process.exit(1);
}
