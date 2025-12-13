# 💻 Code Examples - أمثلة عملية

<div dir="rtl">

## 📋 جدول المحتويات

1. [إنشاء Session و QR](#1-إنشاء-session-و-qr)
2. [إرسال رسائل](#2-إرسال-رسائل)
3. [استقبال رسائل Realtime](#3-استقبال-رسائل-realtime)
4. [تخصيص Auto-Reply بـ AI](#4-تخصيص-auto-reply-بـ-ai)
5. [إرسال Media (صور، فيديوهات)](#5-إرسال-media)
6. [Group Chats](#6-group-chats)
7. [Custom Hooks](#7-custom-hooks)
8. [Error Handling](#8-error-handling)

---

## 1. إنشاء Session و QR

### مثال كامل: صفحة Connect

```typescript
// src/app/(app)/connect/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import QRScanner from '@/components/QRScanner';

export default function ConnectPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeSession();
  }, []);

  async function initializeSession() {
    try {
      // 1. Get or create user
      let { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        user = data.user;
      }

      // 2. Check for existing session
      const { data: existingSession } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('owner_id', user.id)
        .single();

      if (existingSession) {
        setSessionId(existingSession.id);
        setIsLoading(false);
        return;
      }

      // 3. Create new session
      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      const result = await response.json();

      if (result.success) {
        setSessionId(result.session.id);
      }
    } catch (error) {
      console.error('Error initializing session:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function handleConnected() {
    // Redirect to chat after connection
    window.location.href = '/chat';
  }

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto py-12">
      <QRScanner
        sessionId={sessionId!}
        onConnected={handleConnected}
        refreshInterval={5000}  // 5 seconds
      />
    </div>
  );
}
```

---

## 2. إرسال رسائل

### مثال 1: إرسال رسالة نصية بسيطة

```typescript
async function sendTextMessage(
  sessionId: string,
  phoneNumber: string,
  message: string
) {
  try {
    const response = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        to: phoneNumber,  // 201234567890 or 201234567890@s.whatsapp.net
        message
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('✅ Message sent:', result.message);
      return result;
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('❌ Error sending message:', error);
    throw error;
  }
}

// Usage:
await sendTextMessage(
  'session-id-here',
  '201234567890',
  'مرحباً! هذه رسالة تجريبية'
);
```

### مثال 2: إرسال رسائل متعددة

```typescript
async function sendBulkMessages(
  sessionId: string,
  contacts: { phone: string; message: string }[]
) {
  const results = [];

  for (const contact of contacts) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2s between messages

      const result = await sendTextMessage(
        sessionId,
        contact.phone,
        contact.message
      );

      results.push({ phone: contact.phone, success: true, result });
    } catch (error) {
      results.push({ phone: contact.phone, success: false, error });
    }
  }

  return results;
}

// Usage:
const contacts = [
  { phone: '201234567890', message: 'مرحباً أحمد!' },
  { phone: '201234567891', message: 'مرحباً محمد!' },
  { phone: '201234567892', message: 'مرحباً علي!' }
];

const results = await sendBulkMessages('session-id', contacts);
console.log('Results:', results);
```

### مثال 3: React Hook لإرسال رسائل

```typescript
// src/hooks/useSendMessage.ts
import { useState } from 'react';

export function useSendMessage(sessionId: string) {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(to: string, message: string) {
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, to, message })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsSending(false);
    }
  }

  return { send, isSending, error };
}

// Usage in component:
function ChatComponent({ sessionId }) {
  const { send, isSending, error } = useSendMessage(sessionId);

  async function handleSend() {
    try {
      await send('201234567890', 'مرحباً!');
      alert('تم الإرسال بنجاح');
    } catch (error) {
      alert('فشل الإرسال');
    }
  }

  return (
    <button onClick={handleSend} disabled={isSending}>
      {isSending ? 'جاري الإرسال...' : 'إرسال'}
    </button>
  );
}
```

---

## 3. استقبال رسائل Realtime

### مثال 1: الاستماع لرسائل جديدة في Chat محدد

```typescript
// src/hooks/useRealtimeMessages.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useRealtimeMessages(chatId: string) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!chatId) return;

    // Fetch initial messages
    async function fetchMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true });

      setMessages(data || []);
    }

    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, (payload) => {
        console.log('🆕 New message:', payload.new);
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [chatId]);

  return messages;
}

// Usage in component:
function ChatWindow({ chatId }) {
  const messages = useRealtimeMessages(chatId);

  return (
    <div className="messages">
      {messages.map(msg => (
        <div key={msg.id} className={msg.from_me ? 'sent' : 'received'}>
          {msg.body}
        </div>
      ))}
    </div>
  );
}
```

### مثال 2: الاستماع لكل الـ Chats

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useRealtimeChats(sessionId: string) {
  const [chats, setChats] = useState([]);

  useEffect(() => {
    if (!sessionId) return;

    // Fetch initial chats
    async function fetchChats() {
      const { data } = await supabase
        .from('chats')
        .select('*')
        .eq('session_id', sessionId)
        .order('last_message_at', { ascending: false });

      setChats(data || []);
    }

    fetchChats();

    // Subscribe to chat updates
    const channel = supabase
      .channel(`chats:${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chats',
        filter: `session_id=eq.${sessionId}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setChats(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setChats(prev => prev.map(chat =>
            chat.id === payload.new.id ? payload.new : chat
          ));
        } else if (payload.eventType === 'DELETE') {
          setChats(prev => prev.filter(chat => chat.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [sessionId]);

  return chats;
}
```

---

## 4. تخصيص Auto-Reply بـ AI

### مثال 1: استخدام OpenAI GPT

```typescript
// worker-service/src/lib/ai.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateAIReply(
  incomingMessage: string,
  chatHistory: any[] = []
): Promise<string> {
  try {
    const messages = [
      {
        role: 'system',
        content: 'أنت مساعد خدمة عملاء ودود ومفيد. تجيب باللغة العربية.'
      },
      ...chatHistory.map(msg => ({
        role: msg.from_me ? 'assistant' : 'user',
        content: msg.body
      })),
      {
        role: 'user',
        content: incomingMessage
      }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: messages,
      temperature: 0.7,
      max_tokens: 200
    });

    return response.choices[0].message.content || 'عذراً، لم أستطع فهم رسالتك.';
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    return 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.';
  }
}

// في worker.ts:
import { generateAIReply } from './lib/ai';

async function handleAutoReply(sessionId, sock, chat, incomingMessage) {
  try {
    // Fetch chat history
    const { data: history } = await supabaseAdmin
      .from('messages')
      .select('body, from_me')
      .eq('chat_id', chat.id)
      .order('timestamp', { ascending: true })
      .limit(10);

    // Generate AI reply
    const reply = await generateAIReply(incomingMessage, history || []);

    // Send via WhatsApp
    await sock.sendMessage(chat.remote_id, { text: reply });

    // Save to database
    await supabaseAdmin
      .from('messages')
      .insert({
        chat_id: chat.id,
        body: reply,
        from_me: true,
        ai_processed: true,
        ai_response: reply
      });

    console.log(`🤖 AI reply sent to ${chat.name}`);
  } catch (error) {
    console.error('Error in AI auto-reply:', error);
  }
}
```

### مثال 2: استخدام Claude AI

```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

export async function generateClaudeReply(
  incomingMessage: string,
  chatHistory: any[] = []
): Promise<string> {
  try {
    const systemPrompt = `أنت مساعد خدمة عملاء محترف.
    - أجب باللغة العربية دائماً
    - كن ودوداً ومفيداً
    - اجعل ردودك موجزة (2-3 جمل)`;

    const messages = chatHistory.map(msg => ({
      role: msg.from_me ? 'assistant' : 'user',
      content: msg.body
    }));

    messages.push({
      role: 'user',
      content: incomingMessage
    });

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      system: systemPrompt,
      messages: messages
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Error calling Claude:', error);
    return 'عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.';
  }
}
```

---

## 5. إرسال Media

### مثال 1: إرسال صورة

```typescript
// في worker أو API
async function sendImage(
  sock: any,
  jid: string,
  imageUrl: string,
  caption?: string
) {
  try {
    await sock.sendMessage(jid, {
      image: { url: imageUrl },
      caption: caption || ''
    });

    console.log(`✅ Image sent to ${jid}`);
  } catch (error) {
    console.error('Error sending image:', error);
    throw error;
  }
}

// Usage:
await sendImage(
  sock,
  '201234567890@s.whatsapp.net',
  'https://example.com/image.jpg',
  'شاهد هذه الصورة الرائعة!'
);
```

### مثال 2: إرسال فيديو

```typescript
async function sendVideo(
  sock: any,
  jid: string,
  videoUrl: string,
  caption?: string
) {
  await sock.sendMessage(jid, {
    video: { url: videoUrl },
    caption: caption || '',
    gifPlayback: false  // true for GIFs
  });
}
```

### مثال 3: إرسال ملف PDF

```typescript
async function sendDocument(
  sock: any,
  jid: string,
  documentUrl: string,
  fileName: string
) {
  await sock.sendMessage(jid, {
    document: { url: documentUrl },
    fileName: fileName,
    mimetype: 'application/pdf'
  });
}

// Usage:
await sendDocument(
  sock,
  '201234567890@s.whatsapp.net',
  'https://example.com/report.pdf',
  'تقرير_المبيعات.pdf'
);
```

### مثال 4: تحميل Media من رسالة واردة

```typescript
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { supabaseAdmin } from './lib/supabaseAdmin';

async function downloadAndSaveMedia(msg: any, sessionId: string) {
  try {
    const buffer = await downloadMediaMessage(
      msg,
      'buffer',
      {},
      { logger: pino({ level: 'silent' }) as any }
    );

    if (!buffer) return null;

    // Upload to Supabase Storage
    const fileName = `${sessionId}/${Date.now()}.jpg`;

    const { data, error } = await supabaseAdmin
      .storage
      .from('whatsapp-media')
      .upload(fileName, buffer, {
        contentType: msg.message?.imageMessage?.mimetype || 'image/jpeg',
        upsert: false
      });

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from('whatsapp-media')
      .getPublicUrl(fileName);

    console.log(`✅ Media uploaded: ${publicUrl}`);
    return publicUrl;

  } catch (error) {
    console.error('Error downloading media:', error);
    return null;
  }
}
```

---

سأكمل في الرد التالي...

</div>
