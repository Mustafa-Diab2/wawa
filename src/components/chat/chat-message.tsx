import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isFromUs = message.isFromUs;

  return (
    <div className={cn("flex items-end gap-2", isFromUs ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-lg p-3",
          isFromUs
            ? "bg-primary text-primary-foreground rounded-br-none"
            : "bg-muted rounded-bl-none"
        )}
      >
        <p className="text-sm">{message.body}</p>
      </div>
      <div className="flex flex-col items-center">
         <span className="text-[10px] text-muted-foreground">
             {format(message.timestamp, 'HH:mm', { locale: ar })}
        </span>
      </div>
    </div>
  );
}
