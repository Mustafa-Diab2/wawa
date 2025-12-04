'use client';
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { FileText, Image as ImageIcon, Video, Music, Sticker } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isFromUs = message.isFromUs;

  const getFormattedTimestamp = (ts: Date | Timestamp) => {
    try {
      const date = ts instanceof Timestamp ? ts.toDate() : ts;
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return '';
      }
      return format(date, 'HH:mm', { locale: ar });
    } catch (e) {
      console.error('Error formatting timestamp:', e);
      return '';
    }
  };

  const getMediaIcon = () => {
    switch (message.mediaType) {
      case 'image':
        return <ImageIcon className="h-4 w-4 inline mr-1" />;
      case 'video':
        return <Video className="h-4 w-4 inline mr-1" />;
      case 'audio':
        return <Music className="h-4 w-4 inline mr-1" />;
      case 'document':
        return <FileText className="h-4 w-4 inline mr-1" />;
      case 'sticker':
        return <Sticker className="h-4 w-4 inline mr-1" />;
      default:
        return null;
    }
  };

  const renderMedia = () => {
    if (!message.mediaUrl) return null;

    switch (message.mediaType) {
      case 'image':
        return (
          <div className="mt-2">
            <img
              src={message.mediaUrl}
              alt={message.body || 'Image'}
              className="rounded-lg max-w-full h-auto max-h-96 object-contain"
              loading="lazy"
            />
            {message.body && message.body !== '📷 صورة' && (
              <p className="text-sm mt-1">{message.body}</p>
            )}
          </div>
        );

      case 'sticker':
        return (
          <img
            src={message.mediaUrl}
            alt="Sticker"
            className="w-32 h-32 object-contain"
            loading="lazy"
          />
        );

      case 'audio':
        return (
          <div className="mt-2">
            <audio controls className="max-w-full">
              <source src={message.mediaUrl} type="audio/ogg" />
              متصفحك لا يدعم تشغيل الصوت
            </audio>
          </div>
        );

      case 'video':
        return (
          <div className="mt-2">
            <video controls className="rounded-lg max-w-full h-auto max-h-96">
              <source src={message.mediaUrl} type="video/mp4" />
              متصفحك لا يدعم تشغيل الفيديو
            </video>
            {message.body && message.body !== '🎥 فيديو' && (
              <p className="text-sm mt-1">{message.body}</p>
            )}
          </div>
        );

      case 'document':
        return (
          <a
            href={message.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:underline"
          >
            <FileText className="h-4 w-4" />
            {message.body}
          </a>
        );

      default:
        return null;
    }
  };

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
        {message.mediaType && message.mediaUrl ? (
          renderMedia()
        ) : (
          <p className="text-sm whitespace-pre-wrap flex items-center">
            {getMediaIcon()}
            {message.body}
          </p>
        )}
      </div>
      <div className="flex flex-col items-center">
         <span className="text-[10px] text-muted-foreground">
             {getFormattedTimestamp(message.timestamp)}
        </span>
      </div>
    </div>
  );
}
