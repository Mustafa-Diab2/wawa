'use client';
import { useState, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Paperclip, Smile, Mic, Send, Bot, Loader2, StopCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Chat } from '@/lib/types';
import { respondToInquiry } from '@/ai/flows/respond-to-customer-inquiries';
import { useToast } from '@/hooks/use-toast';

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

  const handleSendMessage = async () => {
    if (!message.trim() || !chat || !sessionId) return;

    setIsSending(true);

    try {
      // Send message via API
      const response = await fetch('/api/messages/manual-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          chatId: chat.id,
          message: message.trim(),
        }),
      });

      if (response.ok) {
        setMessage('');
      } else {
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleAiRespond = async () => {
    if (!chat || !sessionId) return;

    setIsAiResponding(true);
    try {
      const result = await respondToInquiry({ chatId: chat.id, sessionId });
      console.log('AI Response:', result);
    } catch (error) {
      console.error('Error getting AI response:', error);
    } finally {
      setIsAiResponding(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
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

    // TODO: Implement file upload
    e.target.value = '';
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage(message + emoji);
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
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        // TODO: Implement audio upload and send
        toast({
          title: 'قريباً',
          description: 'سيتم إضافة إرسال الرسائل الصوتية قريباً',
        });

        stream.getTracks().forEach(track => track.stop());
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

  // Common emojis for quick access
  const commonEmojis = ['😊', '👍', '❤️', '😂', '🙏', '👋', '✅', '🎉', '🔥', '💯'];

  return (
    <div className="border-t bg-background p-4">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
      />
      <div className="flex items-end gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFileSelect}
          title="إرفاق ملف"
        >
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
          onKeyPress={handleKeyPress}
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
          {isAiResponding ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Bot className="h-5 w-5" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={isRecording ? stopRecording : startRecording}
          className={isRecording ? 'text-red-500' : ''}
          title={isRecording ? 'إيقاف التسجيل' : 'تسجيل رسالة صوتية'}
        >
          {isRecording ? (
            <StopCircle className="h-5 w-5 animate-pulse" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>

        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || isSending}
          size="icon"
        >
          {isSending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
