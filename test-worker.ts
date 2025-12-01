import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
// Use a session that was logged as connected
const sessionId = '1AJzO9YRzdBH3Iko9pkZ'; 

async function test() {
  console.log('--- Testing Chat Loading ---');
  const chatsRef = db.collection(`whatsappSessions/${sessionId}/chats`);
  const chatsSnapshot = await chatsRef.limit(5).get();
  
  if (chatsSnapshot.empty) {
    console.log('No chats found in Firestore for this session.');
  } else {
    console.log(`Found ${chatsSnapshot.size} chats. Example:`);
    chatsSnapshot.forEach(doc => {
      console.log(doc.id, doc.data().name || 'No Name');
    });
  }

  console.log('\n--- Testing Sending Message ---');
  // We need a valid chat ID. If we found chats, use one. Otherwise use a dummy.
  const chatId = chatsSnapshot.empty ? '123456789@s.whatsapp.net' : chatsSnapshot.docs[0].id;
  
  const messageData = {
    body: 'Test message from script',
    chatId: chatId,
    isFromUs: true,
    sender: 'me',
    sessionId: sessionId,
    status: 'pending', // This triggers the worker
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const msgRef = await db.collection(`whatsappSessions/${sessionId}/chats/${chatId}/messages`).add(messageData);
  console.log(`Created pending message: ${msgRef.id}`);

  // Wait and check if status changes
  console.log('Waiting for worker to process...');
  
  const unsubscribe = msgRef.onSnapshot(doc => {
    const data = doc.data();
    if (data && data.status !== 'pending') {
      console.log(`Message status updated to: ${data.status}`);
      unsubscribe();
      process.exit(0);
    }
  });

  // Timeout after 10 seconds
  setTimeout(() => {
    console.log('Timeout waiting for message update.');
    process.exit(0);
  }, 15000);
}

test().catch(console.error);
