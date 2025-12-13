'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoreVertical, Phone, Video, Loader2, Bot as BotIcon, User } from "lucide-react";
import ChatInput from "./chat-input";
import ChatMessage from "./chat-message";
import type { Chat, Message, Bot } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { dedupeMessages, messageKeys } from '@/lib/message-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatWindowProps {
  chat: Chat;
  messages: Message[];
  messagesLoading: boolean;
  sessionId: string;
}

export default function ChatWindow({ chat, messages, messagesLoading, sessionId }: ChatWindowProps) {
  const { toast } = useToast();
  const [isTogglingMode, setIsTogglingMode] = useState(false);
  const [bots, setBots] = useState<Bot[]>([]);
  const [currentBot, setCurrentBot] = useState<Bot | null>(null);
  const botsFetchedRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const phoneOrRemote = (chat as any).phone_jid || chat.remote_id || chat.remoteId || chat.id || '';
  const displayNumber = (phoneOrRemote || '').split('@')[0];
  const displayName = chat.name || displayNumber;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current && !messagesLoading) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messagesLoading]);

  const uniqueMessages = useMemo(() => dedupeMessages(messages || []), [messages]);
  const getMessageKey = (msg: Message) => messageKeys(msg)[0] || (msg as any).id;

  // Fetch available bots (once)
  useEffect(() => {
    if (botsFetchedRef.current) return;
    botsFetchedRef.current = true;

    const fetchBots = async () => {
      try {
        const { data, error } = await supabase
          .from('bots')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setBots(data || []);
      } catch (error) {
        console.error('Error fetching bots:', error);
      }
    };

    fetchBots();
  }, []);

  // Set current bot when chat changes or bots are loaded
  useEffect(() => {
    if ((chat as any).bot_id && bots.length > 0) {
      const bot = bots.find((b: Bot) => b.id === (chat as any).bot_id);
      setCurrentBot(bot || null);
    } else {
      setCurrentBot(null);
    }
  }, [chat, bots]);

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

  const assignBot = async (botId: string | null) => {
    try {
      const { error } = await (supabase as any)
        .from('chats')
        .update({ bot_id: botId } as any)
        .eq('id', chat.id);

      if (error) throw error;

      const bot = bots.find(b => b.id === botId);
      setCurrentBot(bot || null);

      toast({
        title: botId ? 'تم تعيين البوت' : 'تم إلغاء تعيين البوت',
        description: botId ? `تم تعيين ${bot?.name}` : 'سيتم استخدام الإعدادات الافتراضية',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل تعيين البوت',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center p-4 border-b">
        <div className="flex items-center gap-3 flex-1">
            <Avatar className="h-10 w-10 border">
            <AvatarImage src={chat.avatar} alt={chat.name || "Chat"} />
            <AvatarFallback>{displayName ? displayName.charAt(0) : 'C'}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{displayName}</h3>
              <Badge
                variant={chat.mode === 'ai' ? 'default' : 'secondary'}
                className="text-xs cursor-pointer"
                onClick={toggleMode}
              >
                {isTogglingMode ? (
                  <Loader2 className="h-3 w-3 animate-spin ml-1" />
                ) : chat.mode === 'ai' ? (
                  <BotIcon className="h-3 w-3 ml-1" />
                ) : (
                  <User className="h-3 w-3 ml-1" />
                )}
                {chat.mode === 'ai' ? 'ذكي' : 'يدوي'}
              </Badge>
              {chat.mode === 'ai' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Badge variant="outline" className="text-xs cursor-pointer">
                      {currentBot ? currentBot.name : 'افتراضي'}
                    </Badge>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuLabel>اختر البوت</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => assignBot(null)}>
                      افتراضي (بدون بوت)
                    </DropdownMenuItem>
                    {bots.map((bot) => (
                      <DropdownMenuItem key={bot.id} onClick={() => assignBot(bot.id)}>
                        <BotIcon className="h-3 w-3 ml-2" />
                        {bot.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
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
              {uniqueMessages.map((message) => (
                <ChatMessage
                  key={getMessageKey(message)}
                  message={message}
                />
              ))}
              <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t">
        <ChatInput chat={chat} sessionId={sessionId} />
      </div>
    </Card>
  );
}
