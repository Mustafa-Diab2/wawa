import {
  Card,
  CardContent
} from "@/components/ui/card";
import ChatList from "@/components/chat/chat-list";
import ChatWindow from "@/components/chat/chat-window";
import ContactDetails from "@/components/chat/contact-details";
import { mockChats, mockMessages } from "@/lib/mock-data";

export default function ChatPage() {
  const selectedChat = mockChats[0];
  const messages = mockMessages[selectedChat.id] || [];
  
  return (
    <div className="grid h-[calc(100vh-8rem)] w-full grid-cols-1 md:grid-cols-10 gap-4">
        <Card className="md:col-span-3 lg:col-span-3">
          <ChatList chats={mockChats} selectedChatId={selectedChat.id} />
        </Card>
        <div className="md:col-span-7 lg:col-span-4 flex flex-col h-full">
            <ChatWindow chat={selectedChat} messages={messages} />
        </div>
        <Card className="hidden lg:block lg:col-span-3">
            <ContactDetails chat={selectedChat} />
        </Card>
    </div>
  );
}
