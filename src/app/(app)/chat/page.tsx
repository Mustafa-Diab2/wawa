'use client';
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Chat, Message } from '@/lib/types';
import { Card } from "@/components/ui/card";
import ChatList from "@/components/chat/chat-list";
import ChatWindow from "@/components/chat/chat-window";
import ContactDetails from "@/components/chat/contact-details";
import NewChatModal from "@/components/chat/new-chat-modal";
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function ChatPage() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const dedupeMessages = (list: Message[]) => {
    const seen = new Set<string>();
    return (list || []).filter((msg) => {
      const key =
        (msg as any).provider_message_id ||
        (msg as any).client_request_id ||
        (msg as any).providerMessageId ||
        msg.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  useEffect(() => {
    const initUser = async () => {
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();

        if (authSession?.user) {
          setUserId(authSession.user.id);
        } else {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          setUserId(data.session?.user.id || null);
        }
      } catch (error) {
        console.error('Error initializing user:', error);
      }
    };

    initUser();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchSession = async () => {
      try {
        const { data, error } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('owner_id', userId)
          .limit(1)
          .single();

        if (error && (error as any).code !== 'PGRST116') return;
        if (data) setSessionId((data as any).id);
      } catch (error) {
        console.error('Error fetching session:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [userId]);

  useEffect(() => {
    if (!sessionId) return;

    const fetchChats = async () => {
      try {
        const { data, error } = await supabase
          .from('chats')
          .select('*')
          .eq('session_id', sessionId)
          .order('last_message_at', { ascending: false });

        if (error) throw error;
        setChats(data || []);
      } catch (error) {
        console.error('Error fetching chats:', error);
      }
    };

    fetchChats();

    const channel = supabase
      .channel(`chats-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chats',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setChats((prev) => [payload.new as Chat, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setChats((prev) => prev.map((c) => (c.id === (payload.new as any).id ? (payload.new as Chat) : c)));
        } else if (payload.eventType === 'DELETE') {
          setChats((prev) => prev.filter((c) => c.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !selectedChatId) return;

    setMessagesLoading(true);

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('chat_id', selectedChatId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(dedupeMessages(data || []));
      } catch (error) {
        console.error('Error fetching messages:', error);
      } finally {
        setMessagesLoading(false);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`messages-${selectedChatId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${selectedChatId}`,
      }, (payload) => {
        const incoming: any = payload.new;

        if (payload.eventType === 'INSERT') {
          setMessages((prev) => dedupeMessages([...prev, payload.new as Message]));
        } else if (payload.eventType === 'UPDATE') {
          setMessages((prev) =>
            prev.map((msg) => {
              const isSameId = (msg as any).id === (payload.new as any).id;
              const sameProvider =
                (msg as any).provider_message_id &&
                (payload.new as any)?.provider_message_id &&
                (msg as any).provider_message_id === (payload.new as any).provider_message_id;
              const sameClient =
                (msg as any).client_request_id &&
                (payload.new as any)?.client_request_id &&
                (msg as any).client_request_id === (payload.new as any).client_request_id;
              return isSameId || sameProvider || sameClient ? (payload.new as Message) : msg;
            })
          );
        } else if (payload.eventType === 'DELETE') {
          setMessages((prev) => prev.filter((msg: any) => msg.id !== (payload.old as any).id));
        }
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [sessionId, selectedChatId]);

  useEffect(() => {
    if (!selectedChatId && chats.length > 0) setSelectedChatId(chats[0].id);
  }, [chats, selectedChatId]);

  const selectedChat = useMemo(
    () => chats.find((c) => c.id === selectedChatId) || null,
    [chats, selectedChatId]
  );

  const handleNewChat = () => setNewChatModalOpen(true);

  const handleSendMessage = async (data: { phone: string; jid: string; message: string }) => {
    const clientRequestId = crypto.randomUUID();
    const response = await fetch('/api/messages/manual-send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        to: data.jid,
        text: data.message,
        assignedTo: userId || null,
        clientRequestId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'فشل إرسال الرسالة');
    }

    const result = await response.json();
    setSelectedChatId(result.chatId);

    toast({ title: 'تم إرسال الرسالة', description: 'تم إنشاء المحادثة بنجاح' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-lg">جاري تحميل محادثاتك...</p>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-2xl font-bold mb-2">لم يتم ربط حساب WhatsApp</h2>
        <p className="text-muted-foreground">
          يرجى الذهاب إلى صفحة <a href="/connect" className="text-primary underline">ربط WhatsApp</a> لمسح QR والبدء.
        </p>
      </div>
    );
  }

  if (!chats || chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-2xl font-bold mb-2">لا توجد محادثات لعرضها</h2>
        <p className="text-muted-foreground">ابدأ محادثة جديدة على WhatsApp لتظهر هنا.</p>
      </div>
    );
  }

  return (
    <>
      <NewChatModal
        open={newChatModalOpen}
        onOpenChange={setNewChatModalOpen}
        onSendMessage={handleSendMessage}
        sessionId={sessionId}
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
          {selectedChat ? (
            <ChatWindow
              chat={selectedChat}
              messages={messages || []}
              messagesLoading={messagesLoading}
              sessionId={sessionId}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p>الرجاء تحديد محادثة لعرضها.</p>
            </div>
          )}
        </div>

        <Card className="hidden lg:block lg:col-span-3">
          {selectedChat ? (
            <ContactDetails chat={selectedChat} />
          ) : (
            <div className="flex h-full items-center justify-center p-4">
              <p>الرجاء تحديد محادثة لعرض تفاصيلها.</p>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
