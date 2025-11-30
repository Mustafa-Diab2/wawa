'use client';
import { useState, useMemo, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import type { Chat, Message, WhatsAppSession } from '@/lib/types';
import { Card, CardContent } from "@/components/ui/card";
import ChatList from "@/components/chat/chat-list";
import ChatWindow from "@/components/chat/chat-window";
import ContactDetails from "@/components/chat/contact-details";
import { Loader2 } from 'lucide-react';

export default function ChatPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // 1. Fetch user's WhatsApp sessions
  const sessionsQuery = useMemoFirebase(
    () =>
      user && firestore
        ? query(
            collection(firestore, 'whatsappSessions'),
            where('ownerId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(1)
          )
        : null,
    [firestore, user]
  );
  const { data: sessions, isLoading: sessionsLoading } = useCollection<WhatsAppSession>(sessionsQuery);
  const activeSessionId = useMemo(() => (sessions && sessions.length > 0 ? sessions[0].id : null), [sessions]);


  // 2. Fetch chats for the active session
  const chatsQuery = useMemoFirebase(
    () =>
      activeSessionId && firestore
        ? query(
            collection(firestore, `whatsappSessions/${activeSessionId}/chats`),
            orderBy('lastMessageAt', 'desc')
          )
        : null,
    [firestore, activeSessionId]
  );
  const { data: chats, isLoading: chatsLoading } = useCollection<Chat>(chatsQuery);

  // Auto-select the first chat when the list loads
  useEffect(() => {
    if (!selectedChatId && chats && chats.length > 0) {
      setSelectedChatId(chats[0].id);
    }
  }, [chats, selectedChatId]);

  // 3. Fetch messages for the selected chat
  const messagesQuery = useMemoFirebase(
    () =>
      activeSessionId && selectedChatId && firestore
        ? query(
            collection(firestore, `whatsappSessions/${activeSessionId}/chats/${selectedChatId}/messages`),
            orderBy('timestamp', 'asc')
          )
        : null,
    [firestore, activeSessionId, selectedChatId]
  );
  const { data: messages, isLoading: messagesLoading } = useCollection<Message>(messagesQuery);
  
  const selectedChat = useMemo(() => chats?.find(c => c.id === selectedChatId) || null, [chats, selectedChatId]);
  
  const isLoading = isUserLoading || sessionsLoading || chatsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-lg">جاري تحميل محادثاتك...</p>
      </div>
    );
  }

  if (!activeSessionId) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-2xl font-bold mb-2">لم يتم ربط حساب WhatsApp</h2>
        <p className="text-muted-foreground">
          يرجى الذهاب إلى صفحة <a href="/connect" className="text-primary underline">ربط WhatsApp</a> لمسح رمز الاستجابة السريعة والبدء.
        </p>
      </div>
    );
  }
  
  if (!chats || chats.length === 0) {
    return (
       <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-2xl font-bold mb-2">لا توجد محادثات لعرضها</h2>
        <p className="text-muted-foreground">
          ابدأ محادثة جديدة على WhatsApp لتظهر هنا.
        </p>
      </div>
    )
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] w-full grid-cols-1 md:grid-cols-10 gap-4">
      <Card className="md:col-span-3 lg:col-span-3">
        <ChatList
          chats={chats}
          selectedChatId={selectedChatId}
          onSelectChat={setSelectedChatId}
        />
      </Card>
      <div className="md:col-span-7 lg:col-span-4 flex flex-col h-full">
        {selectedChat ? (
          <ChatWindow
            chat={selectedChat}
            messages={messages || []}
            messagesLoading={messagesLoading}
          />
        ) : (
           <div className="flex h-full items-center justify-center">
              <p>الرجاء تحديد محادثة لعرضها.</p>
           </div>
        )}
      </div>
      <Card className="hidden lg:block lg:col-span-3">
        {selectedChat ? <ContactDetails chat={selectedChat} /> : <div className="flex h-full items-center justify-center p-4"><p>الرجاء تحديد محادثة لعرض تفاصيلها.</p></div>}
      </Card>
    </div>
  );
}
