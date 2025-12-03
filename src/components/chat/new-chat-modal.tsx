'use client';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { normalizePhoneToJid, isValidPhone } from '@/lib/phone-utils';

interface NewChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendMessage: (data: { phone: string; jid: string; message: string }) => Promise<void>;
  sessionId: string | null;
}

export default function NewChatModal({
  open,
  onOpenChange,
  onSendMessage,
  sessionId,
}: NewChatModalProps) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!phone.trim()) {
      setError('الرجاء إدخال رقم الهاتف');
      return;
    }

    if (!isValidPhone(phone)) {
      setError('رقم الهاتف غير صحيح. يجب أن يحتوي على 10-15 رقماً مع كود الدولة');
      return;
    }

    if (!message.trim()) {
      setError('الرجاء كتابة رسالة');
      return;
    }

    if (!sessionId) {
      setError('الجلسة غير متصلة. الرجاء الاتصال بالواتساب أولاً');
      return;
    }

    try {
      setIsLoading(true);
      const jid = normalizePhoneToJid(phone);

      await onSendMessage({
        phone: phone.trim(),
        jid,
        message: message.trim(),
      });

      // Reset form and close modal
      setPhone('');
      setMessage('');
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إرسال الرسالة');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setPhone('');
    setMessage('');
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl">محادثة جديدة</DialogTitle>
          <DialogDescription>
            أدخل رقم الهاتف والرسالة الأولى لبدء محادثة جديدة
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">رقم الواتساب</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="201234567890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isLoading}
              dir="ltr"
              className="text-left"
            />
            <p className="text-xs text-muted-foreground">
              مثال: 201234567890 (كود الدولة + الرقم بدون صفر أو علامات)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">الرسالة الأولى</Label>
            <Textarea
              id="message"
              placeholder="اكتب الرسالة الأولى هنا..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isLoading}
              rows={4}
              className="resize-none"
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                'إرسال'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
