'use client';
import { useState, useMemo } from 'react';
import { Search, Inbox, CheckCircle, Archive, MessageSquarePlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import type { Chat } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ChatListProps {
  chats: Chat[] | null;
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat?: (phoneNumber: string) => void;
}

type FilterType = 'ALL' | 'INBOX' | 'DONE' | 'ARCHIVED';

export default function ChatList({ chats, selectedChatId, onSelectChat, onNewChat }: ChatListProps) {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');

  // Filter chats based on status and search
  const filteredChats = useMemo(() => {
    if (!chats) return null;

    let filtered = chats;

    // Apply status filter
    if (filter === 'INBOX') {
      filtered = filtered.filter(chat => chat.status === 'INBOX' || !chat.status);
    } else if (filter === 'DONE') {
      filtered = filtered.filter(chat => chat.status === 'DONE');
    } else if (filter === 'ARCHIVED') {
      filtered = filtered.filter(chat => (chat.is_archived ?? chat.isArchived));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(chat => {
        const remoteId = chat.remote_id ?? chat.remoteId;
        const lastMessage = chat.last_message ?? chat.lastMessage;
        return (
          (chat.name?.toLowerCase().includes(query)) ||
          (remoteId?.toLowerCase().includes(query)) ||
          (lastMessage?.toLowerCase().includes(query))
        );
      });
    }

    return filtered;
  }, [chats, filter, searchQuery]);
  const getFormattedTimestamp = (date: any) => {
    if (!date) return '';
    try {
      // Check if it's a Firebase Timestamp and convert it
      if (typeof date.toDate === 'function') {
        return formatDistanceToNow(date.toDate(), { addSuffix: true, locale: ar });
      }
      // Assume it's already a Date object or a string
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return '';
      }
      return formatDistanceToNow(dateObj, { addSuffix: true, locale: ar });
    } catch (e) {
      return '';
    }
  };
  
  const handleNewChat = () => {
    if (phoneNumber.trim() && onNewChat) {
      // Format phone number for WhatsApp (add @s.whatsapp.net)
      const formattedNumber = phoneNumber.replace(/\D/g, '') + '@s.whatsapp.net';
      onNewChat(formattedNumber);
      setNewChatOpen(false);
      setPhoneNumber('');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="p-4 space-y-4">
        <h2 className="text-xl font-bold font-headline">المحادثات</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="outline">
                <MessageSquarePlus className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>محادثة جديدة</DialogTitle>
                <DialogDescription>
                  أدخل رقم الهاتف لبدء محادثة جديدة
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="مثال: 966xxxxxxxxx"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  dir="ltr"
                />
                <Button onClick={handleNewChat} className="w-full">
                  بدء المحادثة
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex justify-between gap-1">
          <Button
            variant={filter === 'ALL' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 gap-2"
            onClick={() => setFilter('ALL')}
          >
            <Inbox className="h-4 w-4" />
            الكل
          </Button>
          <Button
            variant={filter === 'DONE' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 gap-2"
            onClick={() => setFilter('DONE')}
          >
            <CheckCircle className="h-4 w-4" />
            تم
          </Button>
          <Button
            variant={filter === 'ARCHIVED' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 gap-2"
            onClick={() => setFilter('ARCHIVED')}
          >
            <Archive className="h-4 w-4" />
            مؤرشف
          </Button>
        </div>
      </div>
      <Separator />
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {!filteredChats ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))
          ) : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <p>لا توجد محادثات</p>
            </div>
          ) : (
            filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={cn(
                  'flex items-center gap-3 p-4 text-right transition-colors hover:bg-muted/50',
                  selectedChatId === chat.id && 'bg-muted'
                )}
              >
                <Avatar className="h-10 w-10 border">
                  <AvatarImage src={chat.avatar} alt={chat.name || 'Chat'} />
                  <AvatarFallback>
                    {chat.name ? chat.name.charAt(0) : ((chat.remote_id ?? chat.remoteId) || chat.id || '?').charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold truncate">{chat.name || ((chat.remote_id ?? chat.remoteId) || chat.id || '').split('@')[0]}</h3>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {getFormattedTimestamp(chat.last_message_at ?? chat.lastMessageAt)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {chat.last_message ?? chat.lastMessage}
                  </p>
                </div>
                {(chat.is_unread ?? chat.isUnread) && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    1
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
