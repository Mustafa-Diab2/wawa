'use client';
import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, Smile, Mic, Send, Bot } from 'lucide-react';

export default function ChatInput() {
  const [message, setMessage] = useState('');

  return (
    <div className="relative">
      <Textarea
        placeholder="اكتب رسالتك هنا..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        className="min-h-[48px] resize-none rounded-2xl pr-28 pl-12 py-3"
      />
      <div className="absolute top-1/2 -translate-y-1/2 right-3 flex gap-1">
        <Button variant="ghost" size="icon">
          <Smile className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <Paperclip className="h-5 w-5" />
        </Button>
         <Button variant="ghost" size="icon">
          <Bot className="h-5 w-5" />
        </Button>
      </div>
      <div className="absolute top-1/2 -translate-y-1/2 left-3">
        {message ? (
          <Button size="icon">
            <Send className="h-5 w-5" />
          </Button>
        ) : (
          <Button size="icon">
            <Mic className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
}
