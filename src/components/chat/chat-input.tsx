// src/components/chat/chat-input.tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, Smile, Mic, Send, Bot, Loader2, StopCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Chat } from '@/lib/types';
import { respondToInquiry } from '@/ai/flows/respond-to-customer-inquiries';
import { useToast } from '@/hooks/use-toast';

/**
 * Global send lock (shared across multiple mounted ChatInput instances).
 * Fixes duplicate manual-send when the input is rendered twice (desktop/mobile layouts)
 * or when two handlers race.
 */
const globalSendLocks = new Map<string, boolean>();
const globalLastSendAt = new Map<string, number>();

interface ChatInputProps {
  chat: Chat;
  sessionId: string;
}

export default function ChatInput({ chat, sessionId }: ChatInputProps) {
  const { toast } = useToast();

  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Local lock (per instance) + in-flight request id
  const sendingRef = useRef(false);
  const inflightClientRequestIdRef = useRef<string | null>(null);

  const getLockKey = () => `${sessionId}:${chat?.id || 'nochat'}`;

  const handleSendMessage = useCallback(async () => {
    const text = message.trim();
    if (!text || !chat || !sessionId) return;

    const lockKey = getLockKey();

    // Extra protection: tiny throttle (prevents ultra-fast double triggers)
    const now = Date.now();
    const lastAt = globalLastSendAt.get(lockKey) || 0;
    if (now - lastAt < 600) return;

    // Global lock across any ChatInput instances
    if (globalSendLocks.get(lockKey)) return;

    // Local lock for this instance
    if (sendingRef.current) return;

    // Lock immediately (no waiting for React state)
    globalSendLocks.set(lockKey, true);
    globalLastSendAt.set(lockKey, now);
    sendingRef.current = true;
    setIsSending(true);

    // IMPORTANT: use the same clientRequestId for this in-flight send
    // so even if something somehow re-enters, it won't generate a new id.
    const clientRequestId =
      inflightClientRequestIdRef.current || crypto.randomUUID();
    inflightClientRequestIdRef.current = clientRequestId;

    try {
      // Prefer phone_jid if present (avoid LID surprises)
      const remoteJid = (chat as any).phone_jid || chat.remote_id || (chat as any).remoteId || '';

      const response = await fetch('/api/messages/manual-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          to: remoteJid,
          text,
          clientRequestId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to send message');
      }

      setMessage('');
      toast({
        title: 'تم إرسال الرسالة',
        description: data?.deduped
          ? 'تم منع إرسال مكرر (Idempotency)'
          : 'تم إرسال رسالتك بنجاح',
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'خطأ',
        description: error?.message || 'فشل إرسال الرسالة',
        variant: 'destructive',
      });
    } finally {
      inflightClientRequestIdRef.current = null;
      setIsSending(false);
      sendingRef.current = false;
      globalSendLocks.delete(lockKey);
    }
  }, [message, chat, sessionId, toast]);

  const handleAiRespond = async () => {
    if (!chat || !sessionId) return;

    setIsAiResponding(true);
    try {
      const result = await respondToInquiry({
        message: message || '',
        chatContext: String(chat.id || sessionId),
      });
      console.log('AI Response:', result);
    } catch (error) {
      console.error('Error getting AI response:', error);
    } finally {
      setIsAiResponding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ignore IME composition (Arabic/emoji/IME can cause duplicate Enter behaviors)
    // @ts-ignore
    if (e.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      // Prevent held-key repeat
      if (e.repeat) return;

      // If already sending (any instance)
      const lockKey = getLockKey();
      if (globalSendLocks.get(lockKey) || sendingRef.current) return;

      handleSendMessage();
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast({
      title: 'قريباً',
      description: 'سيتم إضافة إرسال الملفات قريباً',
    });

    e.target.value = '';
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const audioChunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        // const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        toast({
          title: 'قريباً',
          description: 'سيتم إضافة إرسال الرسائل الصوتية قريباً',
        });

        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: 'خطأ',
        description: 'فشل الوصول إلى الميكروفون',
        variant: 'destructive',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const commonEmojis = ['😊', '👍', '❤️', '😂', '🙏', '👋', '✅', '🎉', '🔥', '💯'];

  return (
    <div className="bg-background">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
      />

      <div className="flex items-end gap-2">
        <Button variant="ghost" size="icon" onClick={handleFileSelect} title="إرفاق ملف">
          <Paperclip className="h-5 w-5" />
        </Button>

        <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" title="إضافة إيموجي">
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="grid grid-cols-5 gap-2">
              {commonEmojis.map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  className="text-2xl h-12 w-12"
                  onClick={() => handleEmojiSelect(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
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
          {isAiResponding ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bot className="h-5 w-5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={isRecording ? stopRecording : startRecording}
          className={isRecording ? 'text-red-500' : ''}
          title={isRecording ? 'إيقاف التسجيل' : 'تسجيل رسالة صوتية'}
        >
          {isRecording ? <StopCircle className="h-5 w-5 animate-pulse" /> : <Mic className="h-5 w-5" />}
        </Button>

        <Button onClick={handleSendMessage} disabled={!message.trim() || isSending} size="icon">
          {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
}
