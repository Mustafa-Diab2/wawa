import { NextRequest, NextResponse } from 'next/server';
import { adminDb, admin } from '@/lib/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, to, text, assignedTo } = body;

    // Validation
    if (!sessionId || !to || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, to, text' },
        { status: 400 }
      );
    }

    // Check if session exists and is ready
    const sessionDoc = await adminDb.collection('whatsappSessions').doc(sessionId).get();

    if (!sessionDoc.exists) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const sessionData = sessionDoc.data();
    if (!sessionData?.isReady) {
      return NextResponse.json(
        { error: 'WhatsApp not connected. Please connect first.' },
        { status: 400 }
      );
    }

    // Normalize JID (should already be in format: 201234567890@s.whatsapp.net)
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;

    // Create or get existing chat
    const chatsRef = adminDb.collection('whatsappSessions').doc(sessionId).collection('chats');
    const existingChats = await chatsRef.where('remoteId', '==', jid).limit(1).get();

    let chatId: string;
    let chatDoc;

    if (!existingChats.empty) {
      chatDoc = existingChats.docs[0];
      chatId = chatDoc.id;
    } else {
      // Create new chat
      const newChatRef = chatsRef.doc();
      chatId = newChatRef.id;

      await newChatRef.set({
        id: chatId,
        remoteId: jid,
        name: jid.split('@')[0], // Use phone number as name initially
        type: 'INDIVIDUAL',
        status: 'INBOX',
        isUnread: false,
        lastMessage: text,
        lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
        assignedTo: assignedTo || null,
        isGroup: false,
        isRead: true,
        isMuted: false,
        isArchived: false,
        sessionId,
        mode: 'ai', // Default to AI mode
        needsHuman: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      chatDoc = await newChatRef.get();
    }

    // Create message document with status 'pending'
    // The worker will pick it up and send it via Baileys
    const messageRef = chatsRef.doc(chatId).collection('messages').doc();

    await messageRef.set({
      id: messageRef.id,
      chatId,
      sender: 'agent',
      body: text,
      text,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isFromUs: true,
      isFromMe: true,
      mediaType: null,
      mediaUrl: null,
      status: 'pending', // Worker will change this to 'sent' after sending
      sessionId,
    });

    // Update chat's last message
    await chatsRef.doc(chatId).update({
      lastMessage: text,
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      chatId,
      messageId: messageRef.id,
      chat: chatDoc.data(),
    });
  } catch (error: any) {
    console.error('Error in manual-send API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
