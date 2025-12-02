'use client';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, Smile, Mic, Send, Bot, Loader2 } from 'lucide-react';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import type { Chat } from '@/lib/types';
import { respondToInquiry } from '@/ai/flows/respond-to-customer-inquiries';

interface ChatInputProps {
  chat: Chat;
  sessionId: string;
}

export default function ChatInput({ chat, sessionId }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const firestore = useFirestore();
  const { user } = useUser();

  const handleSendMessage = async () => {
    if (!message.trim() || !firestore || !user || !chat || !sessionId) return;

    setIsSending(true);

    const messagesColRef = collection(firestore, `whatsappSessions/${sessionId}/chats/${chat.id}/messages`);
    
    const messageData = {
      body: message,
      text: message,
      chatId: chat.id,
      isFromMe: true,
      isFromUs: true,
      sessionId: sessionId,
      status: 'pending' as const,
      timestamp: serverTimestamp(),
      createdAt: serverTimestamp(),
    };
    
    try {
      // Non-blocking update
      addDocumentNonBlocking(messagesColRef, messageData);
      setMessage('');
    } catch(error) {
        console.error("Error sending message: ", error);
        // Optionally show a toast to the user
    } finally {
        setIsSending(false);
    }
  };

  const handleAiResponse = async () => {
    if (!chat || !firestore || !user) return;
    setIsAiResponding(true);
    try {
      // For context, we are just passing the last message for now.
      // A more complete implementation would pass more of the conversation.
      const result = await respondToInquiry({
        message: 'Please respond to the customer',
        chatContext: chat.lastMessage || ''
      });
      
      if(result.response) {
        setMessage(result.response);
      }

    } catch (error) {
      console.error('Error getting AI response:', error);
    } finally {
      setIsAiResponding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="relative">
      <Textarea
        placeholder="اكتب رسالتك هنا..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        className="min-h-[48px] resize-none rounded-2xl pr-28 pl-12 py-3"
        disabled={isSending || isAiResponding}
      />
      <div className="absolute top-1/2 -translate-y-1/2 right-3 flex gap-1">
        <Button variant="ghost" size="icon">
          <Smile className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <Paperclip className="h-5 w-5" />
        </Button>
         <Button variant="ghost" size="icon" onClick={handleAiResponse} disabled={isAiResponding}>
          {isAiResponding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bot className="h-5 w-5" />}
        </Button>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 left-3">
        {message ? (
          <Button size="icon" onClick={handleSendMessage} disabled={isSending}>
            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        ) : (
          <Button size="icon" disabled={isSending}>
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
