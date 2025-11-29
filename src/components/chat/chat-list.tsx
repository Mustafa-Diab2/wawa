'use client';
import { Search, Inbox, CheckCircle, Archive } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Chat } from '@/lib/types';

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string;
}

export default function ChatList({ chats, selectedChatId }: ChatListProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-4 space-y-4">
        <h2 className="text-xl font-bold font-headline">المحادثات</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث..." className="pl-9" />
        </div>
        <div className="flex justify-between gap-1">
          <Button variant="ghost" size="sm" className="flex-1 gap-2">
            <Inbox className="h-4 w-4" />
            الكل
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 gap-2 text-primary">
            <CheckCircle className="h-4 w-4" />
            تم
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 gap-2">
            <Archive className="h-4 w-4" />
            مؤرشف
          </Button>
        </div>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {chats.map((chat) => (
            <button
              key={chat.id}
              className={cn(
                'flex items-center gap-3 p-4 text-right transition-colors hover:bg-muted/50',
                selectedChatId === chat.id && 'bg-muted'
              )}
            >
              <Avatar className="h-10 w-10 border">
                <AvatarImage src={chat.avatar} alt={chat.name || 'Chat'} />
                <AvatarFallback>
                  {chat.name ? chat.name.charAt(0) : 'C'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold truncate">{chat.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(chat.lastMessageAt, { addSuffix: true, locale: ar })}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground truncate">
                  {chat.lastMessage}
                </p>
              </div>
              {chat.isUnread && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  1
                </div>
              )}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
