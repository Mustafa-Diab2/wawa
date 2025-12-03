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
import NewChatModal from "@/components/chat/new-chat-modal";
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ChatPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);

  const handleNewChat = (phoneNumber: string) => {
    // Open the new chat modal
    setNewChatModalOpen(true);
  };

  const handleSendMessage = async (data: { phone: string; jid: string; message: string }) => {
    try {
      const response = await fetch('/api/messages/manual-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          to: data.jid,
          text: data.message,
          assignedTo: user?.uid || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'فشل إرسال الرسالة');
      }

      const result = await response.json();

      // Select the newly created chat
      setSelectedChatId(result.chatId);

      toast({
        title: 'تم إرسال الرسالة',
        description: 'تم إنشاء المحادثة بنجاح',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إرسال الرسالة',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // 1. Fetch user's WhatsApp sessions
  const sessionsQuery = useMemoFirebase(
    () =>
      user && firestore
        ? query(
            collection(firestore, 'whatsappSessions'),
            where('ownerId', '==', user.uid),
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
    <>
      <NewChatModal
        open={newChatModalOpen}
        onOpenChange={setNewChatModalOpen}
        onSendMessage={handleSendMessage}
        sessionId={activeSessionId}
      />
      <div className="grid h-[calc(100vh-8rem)] w-full grid-cols-1 md:grid-cols-10 gap-4">
        <Card className="md:col-span-3 lg:col-span-3">
          <ChatList
            chats={chats}
            selectedChatId={selectedChatId}
            onSelectChat={setSelectedChatId}
            onNewChat={handleNewChat}
          />
        </Card>
      <div className="md:col-span-7 lg:col-span-4 flex flex-col h-full">
        {selectedChatId && activeSessionId ? (
          <ChatWindow
            chat={selectedChat || {
              id: selectedChatId,
              remoteId: selectedChatId,
              name: selectedChatId.split('@')[0],
              type: 'INDIVIDUAL',
              status: 'INBOX',
              isGroup: false,
              isRead: true,
              isMuted: false,
              isArchived: false,
              assignedTo: null,
              sessionId: activeSessionId,
              mode: 'ai',
              needsHuman: false,
              createdAt: new Date() as any,
              updatedAt: new Date() as any,
              lastMessageAt: new Date() as any,
            }}
            messages={messages || []}
            messagesLoading={messagesLoading}
            sessionId={activeSessionId}
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
    </>
  );
}
