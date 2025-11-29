import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MoreVertical, Phone, Video } from "lucide-react";
import ChatInput from "./chat-input";
import ChatMessage from "./chat-message";
import type { Chat, Message } from "@/lib/types";

interface ChatWindowProps {
  chat: Chat;
  messages: Message[];
}

export default function ChatWindow({ chat, messages }: ChatWindowProps) {
  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-center p-4 border-b">
        <div className="flex items-center gap-3 flex-1">
          <Avatar className="h-10 w-10 border">
            <AvatarImage src={chat.avatar} alt={chat.name || "Chat"} />
            <AvatarFallback>{chat.name ? chat.name.charAt(0) : "C"}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{chat.name}</h3>
            <p className="text-xs text-muted-foreground">متصل الآن</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon"><Phone className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon"><Video className="h-5 w-5" /></Button>
          <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
            {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
            ))}
        </div>
      </ScrollArea>

      <Separator />

      <div className="p-4">
        <ChatInput />
      </div>
    </Card>
  );
}

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
