import * as admin from 'firebase-admin';

// Initialize Firebase Admin (ensure it shares the same config/env as the worker)
if (!admin.apps.length) {
    try {
        admin.initializeApp();
        console.log('Firebase Admin initialized in test script.');
    } catch (error) {
        console.error('Failed to initialize Firebase Admin:', error);
        process.exit(1);
    }
}

const db = admin.firestore();
const SESSION_ID = `test-session-${Date.now()}`;
const CHAT_ID = '123456789@s.whatsapp.net'; // Dummy chat ID

async function runTest() {
    console.log(`\n=== Starting Integration Test for Session: ${SESSION_ID} ===\n`);

    // 1. Create Session
    console.log('1. Creating session document...');
    const sessionRef = db.collection('whatsappSessions').doc(SESSION_ID);
    await sessionRef.set({
        isReady: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('   Session document created.');

    // 2. Wait for QR Code
    console.log('2. Waiting for QR code generation...');
    const waitForQR = new Promise<string>((resolve, reject) => {
        const unsubscribe = sessionRef.onSnapshot((snapshot) => {
            const data = snapshot.data();
            if (data?.qr) {
                unsubscribe();
                resolve(data.qr);
            }
        }, reject);
        
        // Timeout after 30 seconds
        setTimeout(() => {
            unsubscribe();
            reject(new Error('Timeout waiting for QR code'));
        }, 30000);
    });

    try {
        const qrCode = await waitForQR;
        console.log('   [SUCCESS] QR Code received!');
        console.log(`   QR Data Length: ${qrCode.length}`);
        // console.log(`   QR Data: ${qrCode.substring(0, 50)}...`);
    } catch (error) {
        console.error('   [FAILURE] Timed out waiting for QR code. Is the worker running?');
        process.exit(1);
    }

    // 3. Test Message Sending (Queuing)
    // Note: This will likely fail to *actually* send without a scanned session, 
    // but we can verify the worker picks it up or tries.
    console.log('\n3. Testing Message Queuing...');
    const messageRef = sessionRef.collection('chats').doc(CHAT_ID).collection('messages').doc();
    const messageId = messageRef.id;

    console.log(`   Creating pending message: ${messageId}`);
    await messageRef.set({
        sessionId: SESSION_ID,
        chatId: CHAT_ID,
        body: 'Hello from test script!',
        status: 'pending',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        isFromMe: true
    });

    console.log('   Message queued. Watching for status change...');
    
    const waitForStatusChange = new Promise<string>((resolve, reject) => {
        const unsubscribe = messageRef.onSnapshot((snapshot) => {
            const data = snapshot.data();
            if (data?.status && data.status !== 'pending') {
                unsubscribe();
                resolve(data.status);
            }
        }, reject);

        // Timeout after 15 seconds
        setTimeout(() => {
            unsubscribe();
            resolve('pending (timeout)'); // Not necessarily a failure if we aren't logged in
        }, 15000);
    });

    const finalStatus = await waitForStatusChange;
    console.log(`   Message status changed to: ${finalStatus}`);
    
    if (finalStatus === 'pending (timeout)') {
        console.log('   Note: Message remained pending, which is expected if the QR code was not scanned.');
    } else if (finalStatus === 'failed') {
        console.log('   Note: Message failed, which means the worker attempted to send but likely encountered an error (not logged in).');
    } else if (finalStatus === 'sent') {
        console.log('   [SUCCESS] Message marked as sent!');
    }

    console.log('\n=== Test Complete ===');
    console.log('To fully test sending/receiving/loading chats, you must scan the QR code manually.');
    console.log(`Cleanup: You may want to delete the session doc: whatsappSessions/${SESSION_ID}`);
    
    process.exit(0);
}

runTest();
