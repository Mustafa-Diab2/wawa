'use client';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoreVertical, Phone, Video, Loader2, Bot, User } from "lucide-react";
import ChatInput from "./chat-input";
import ChatMessage from "./chat-message";
import type { Chat, Message } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';

interface ChatWindowProps {
  chat: Chat;
  messages: Message[];
  messagesLoading: boolean;
  sessionId: string;
}

export default function ChatWindow({ chat, messages, messagesLoading, sessionId }: ChatWindowProps) {
  const { toast } = useToast();
  const [isTogglingMode, setIsTogglingMode] = useState(false);

  const toggleMode = async () => {
    if (isTogglingMode) return;

    try {
      setIsTogglingMode(true);
      const newMode = chat.mode === 'ai' ? 'human' : 'ai';

      // Update via API
      const response = await fetch('/api/chats/toggle-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          chatId: chat.id,
          mode: newMode,
        }),
      });

      if (response.ok) {
        toast({
          title: newMode === 'ai' ? 'تم التبديل إلى الوضع الذكي' : 'تم التبديل إلى الوضع اليدوي',
          description: newMode === 'ai' ? 'سيرد الذكاء الاصطناعي تلقائياً' : 'يجب الرد يدوياً على الرسائل',
        });
      } else {
        throw new Error('Failed to toggle mode');
      }
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل تبديل الوضع',
        variant: 'destructive',
      });
    } finally {
      setIsTogglingMode(false);
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center p-4 border-b">
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={chat.avatar} alt={chat.name || "Chat"} />
            <AvatarFallback>{chat.name ? chat.name.charAt(0) : "C"}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{chat.name || (chat.remote_id ?? chat.remoteId ?? '').split('@')[0]}</h3>
              <Badge
                variant={chat.mode === 'ai' ? 'default' : 'secondary'}
                className="text-xs cursor-pointer"
                onClick={toggleMode}
              >
                {isTogglingMode ? (
                  <Loader2 className="h-3 w-3 animate-spin ml-1" />
                ) : chat.mode === 'ai' ? (
                  <Bot className="h-3 w-3 ml-1" />
                ) : (
                  <User className="h-3 w-3 ml-1" />
                )}
                {chat.mode === 'ai' ? 'ذكي' : 'يدوي'}
              </Badge>
              {(chat.needs_human ?? chat.needsHuman) && (
                <Badge variant="destructive" className="text-xs">
                  يحتاج خدمة عملاء
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">متصل الآن</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon"><Phone className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon"><Video className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4 bg-background/50">
        {messagesLoading && messages.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
              {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
              ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t">
        <ChatInput chat={chat} sessionId={sessionId} />
      </div>
    </Card>
  );
}
