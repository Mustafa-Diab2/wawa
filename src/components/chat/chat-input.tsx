'use client';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, Smile, Mic, Send, Bot, Loader2 } from 'lucide-react';
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

  const handleSendMessage = async () => {
    if (!message.trim() || !chat || !sessionId) return;

    setIsSending(true);

    try {
      // Send message via API
      const response = await fetch('/api/messages/manual-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          chatId: chat.id,
          message: message.trim(),
        }),
      });

      if (response.ok) {
        setMessage('');
      } else {
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleAiRespond = async () => {
    if (!chat || !sessionId) return;

    setIsAiResponding(true);
    try {
      const result = await respondToInquiry({ chatId: chat.id, sessionId });
      console.log('AI Response:', result);
    } catch (error) {
      console.error('Error getting AI response:', error);
    } finally {
      setIsAiResponding(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="border-t bg-background p-4">
      <div className="flex items-end gap-2">
        <Button variant="ghost" size="icon" disabled>
          <Paperclip className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" disabled>
          <Smile className="h-5 w-5" />
        </Button>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="اكتب رسالتك هنا..."
          className="min-h-[40px] max-h-[120px] resize-none"
          disabled={isSending}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleAiRespond}
          disabled={isAiResponding || chat.mode === 'human'}
          title="رد تلقائي بالذكاء الاصطناعي"
        >
          {isAiResponding ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Bot className="h-5 w-5" />
          )}
        </Button>
        <Button variant="ghost" size="icon" disabled>
          <Mic className="h-5 w-5" />
        </Button>
        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || isSending}
          size="icon"
        >
          {isSending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
