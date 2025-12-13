# 🚀 WhatsApp CRM - مشروع كامل من الصفر

<div dir="rtl">

## 📖 نظرة عامة

مشروع WhatsApp CRM متكامل يحل جميع المشاكل الشائعة في أنظمة WhatsApp Web:

### ✅ المشاكل التي تم حلها:

1. **QR Code يتجدد تلقائياً** كل 5 ثوانٍ (قابل للتخصيص)
2. **لا توجد محادثات مكررة** - كل رقم له chat واحد فقط
3. **الردود التلقائية** تظهر في نفس الشات (لا تفتح chat جديد)
4. **Session Management** محفوظ بشكل صحيح في WebView
5. **دعم كامل** لـ Supabase & Firebase
6. **Webhook** جاهز لـ WhatsApp Business API

---

## 📂 هيكل المشروع

```
whatsapp-crm/
├── 📄 COMPLETE_GUIDE.md              # دليل شامل لهيكل المشروع
├── 📄 WORKER_SERVICE_GUIDE.md        # QR Manager & Session Manager
├── 📄 WORKER_MAIN_CODE.md            # كود Worker الرئيسي
├── 📄 BACKEND_APIs_GUIDE.md          # جميع APIs (QR, Session, Messages, Webhook)
├── 📄 FRONTEND_COMPONENTS_GUIDE.md   # QRScanner & Session Storage
├── 📄 DEPLOYMENT_GUIDE.md            # دليل النشر الكامل
└── 📄 COMPLETE_PROJECT_README.md     # هذا الملف
```

---

## 🎯 الميزات الرئيسية

### 1. QR Code Auto-Refresh
- QR يتولد تلقائياً ويتجدد كل 5 ثوانٍ
- QR ينتهي صلاحيته بعد 5 دقائق
- منع التحديثات المكررة لنفس QR
- عرض countdown timer للوقت المتبقي

### 2. No Duplicate Chats
```sql
-- استخدام UNIQUE constraint:
UNIQUE (session_id, remote_id)

-- في API:
onConflict: 'session_id,remote_id'

-- في Worker:
onConflict: 'session_id,remote_id'
```

### 3. Session Persistence
- Auth credentials تُحفظ على الديسك
- Auto-reconnect عند انقطاع الاتصال
- WebView cookies محفوظة
- LocalStorage للـ session data

### 4. Auto-Reply System
- ردود تلقائية على الرسائل (AI mode)
- الرد يُحفظ في نفس الـ chat
- قابل للتخصيص بـ AI/GPT

### 5. Multi-Platform Support
- ✅ Supabase (Database, Auth, Storage)
- ✅ Firebase (Optional - للميزات الإضافية)
- ✅ WhatsApp Web API (Baileys)
- ✅ WhatsApp Business API (Webhook ready)

---

## 🛠️ التقنيات المستخدمة

### Frontend:
- **Next.js 14** (App Router)
- **React 18**
- **TypeScript**
- **Tailwind CSS**
- **Zustand** (State Management)

### Backend:
- **Supabase** (Database, Auth, Realtime)
- **Node.js 20+**
- **Baileys** (WhatsApp Web API)
- **PM2** (Process Manager)

### Infrastructure:
- **Vercel** (Frontend Hosting)
- **VPS** (Worker Service)
- **Nginx** (Reverse Proxy)

---

## 📥 التثبيت السريع

### 1. Clone المشروع

```bash
git clone https://github.com/your-repo/whatsapp-crm.git
cd whatsapp-crm
```

### 2. تثبيت Dependencies

```bash
# Frontend
npm install

# Worker
cd worker-service
npm install
cd ..
```

### 3. إعداد Environment Variables

```bash
cp .env.example .env.local
```

**محتوى .env.local:**
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# WhatsApp
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-secure-token
QR_REFRESH_INTERVAL=5000
QR_EXPIRY_TIME=300000

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=your-session-secret
```

### 4. إعداد Supabase Database

```bash
# تثبيت Supabase CLI
npm install -g supabase

# ربط المشروع
supabase link --project-ref your-project-ref

# تطبيق Migrations
supabase db push
```

**أو يدوياً:**
- افتح Supabase SQL Editor
- نسخ والصق SQL من `COMPLETE_GUIDE.md` قسم Database Schema

### 5. تشغيل المشروع محلياً

```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Worker
npm run worker:dev
```

**افتح المتصفح:**
- Frontend: http://localhost:3000
- Connect page: http://localhost:3000/connect

---

## 🚀 النشر (Production)

### خيار 1: نشر كامل (Vercel + VPS)

**اتبع الخطوات في:**
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

**ملخص:**
1. إنشاء مشروع Supabase
2. تطبيق Database Migrations
3. استئجار VPS (DigitalOcean, AWS, etc.)
4. نشر Worker على VPS بـ PM2
5. ربط GitHub بـ Vercel
6. Deploy Frontend على Vercel

### خيار 2: نشر على خادم واحد

```bash
# على VPS واحد:
# 1. Frontend (Next.js) على Port 3000
# 2. Worker على background بـ PM2

pm2 start npm --name "frontend" -- start
pm2 start npm --name "worker" --cwd worker-service -- start

# Nginx Reverse Proxy:
# - Domain -> Frontend (3000)
# - Worker يعمل في Background
```

---

## 📖 دليل الاستخدام

### 1. إنشاء Session جديدة

```typescript
// API Call
const response = await fetch('/api/session/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'user-id' })
});

const { session } = await response.json();
console.log('Session ID:', session.id);
```

### 2. عرض QR Code

```tsx
import QRScanner from '@/components/QRScanner';

<QRScanner
  sessionId={sessionId}
  onConnected={() => console.log('Connected!')}
  refreshInterval={5000}  // 5 seconds
/>
```

### 3. إرسال رسالة

```typescript
const response = await fetch('/api/messages/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'session-id',
    to: '201234567890',  // أو 201234567890@s.whatsapp.net
    message: 'مرحباً!'
  })
});
```

### 4. الاستماع للرسائل الجديدة

```typescript
// استخدام Supabase Realtime
const channel = supabase
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `chat_id=eq.${chatId}`
  }, (payload) => {
    console.log('New message:', payload.new);
  })
  .subscribe();
```

---

## 🔧 التخصيص

### تغيير QR Refresh Interval

```bash
# في .env.local:
QR_REFRESH_INTERVAL=3000  # 3 seconds
QR_EXPIRY_TIME=180000     # 3 minutes
```

### تخصيص Auto-Reply

```typescript
// في worker-service/src/worker.ts
async function handleAutoReply(sessionId, sock, chat, incomingMessage) {
  // استبدل بـ AI API الخاص بك:
  const reply = await callYourAI(incomingMessage);

  await sock.sendMessage(chat.remote_id, { text: reply });

  // حفظ في Database
  await supabaseAdmin.from('messages').insert({
    chat_id: chat.id,
    body: reply,
    from_me: true,
    ai_processed: true
  });
}
```

### إضافة Media Support

```typescript
// إرسال صورة:
await sock.sendMessage(jid, {
  image: { url: 'https://example.com/image.jpg' },
  caption: 'شاهد هذه الصورة'
});

// إرسال ملف:
await sock.sendMessage(jid, {
  document: { url: 'https://example.com/file.pdf' },
  fileName: 'document.pdf',
  mimetype: 'application/pdf'
});
```

---

## 🧪 الاختبار

### Test 1: QR Generation

```bash
# 1. افتح /connect
# 2. QR يجب أن يظهر خلال 5 ثوانٍ
# 3. QR يتجدد كل 5 ثوانٍ
# 4. Countdown timer يعمل
```

### Test 2: No Duplicate Chats

```bash
# 1. أرسل رسالة manual لرقم +201234567890
# 2. اطلب من الرقم الرد
# 3. تحقق في /chat - يجب chat واحد فقط

# SQL Test:
SELECT session_id, remote_id, COUNT(*)
FROM chats
GROUP BY session_id, remote_id
HAVING COUNT(*) > 1;

# Result: 0 rows (No duplicates ✅)
```

### Test 3: Session Persistence

```bash
# 1. اتصل بـ WhatsApp
# 2. أغلق المتصفح
# 3. افتح المتصفح مرة أخرى
# 4. يجب أن تكون متصلاً (لا حاجة لـ QR جديد)
```

---

## 🆘 Troubleshooting

### مشكلة: QR لا يظهر

**الأسباب المحتملة:**
1. Worker غير شغال
2. Supabase credentials خطأ
3. Session غير موجودة في Database

**الحل:**
```bash
# تحقق من Worker:
pm2 logs whatsapp-worker

# يجب أن ترى:
# ✅ "QR RECEIVED for session..."
# ✅ "✅ QR Code updated in Supabase"
```

### مشكلة: Chats مكررة

**الحل:**
```sql
-- تحقق من UNIQUE constraint:
\d chats

-- يجب أن ترى:
-- "chats_session_remote_unique" UNIQUE (session_id, remote_id)

-- إذا غير موجود، أضفه:
ALTER TABLE chats
ADD CONSTRAINT chats_session_remote_unique
UNIQUE (session_id, remote_id);

-- احذف الـ duplicates:
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY session_id, remote_id
    ORDER BY created_at DESC
  ) as rn
  FROM chats
)
DELETE FROM chats WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
```

### مشكلة: Worker يتوقف

**الحل:**
```bash
# تأكد من PM2 startup:
pm2 startup systemd
pm2 save

# زيادة memory limit:
pm2 delete whatsapp-worker
pm2 start npm --name "whatsapp-worker" \
  --max-memory-restart 500M \
  -- start

# مراقبة الـ memory:
pm2 monit
```

---

## 📚 المراجع

### الوثائق الكاملة:
1. [COMPLETE_GUIDE.md](COMPLETE_GUIDE.md) - هيكل المشروع و Database Schema
2. [WORKER_SERVICE_GUIDE.md](WORKER_SERVICE_GUIDE.md) - QR Manager & Session Manager
3. [WORKER_MAIN_CODE.md](WORKER_MAIN_CODE.md) - كود Worker الكامل
4. [BACKEND_APIs_GUIDE.md](BACKEND_APIs_GUIDE.md) - جميع APIs
5. [FRONTEND_COMPONENTS_GUIDE.md](FRONTEND_COMPONENTS_GUIDE.md) - React Components
6. [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - دليل النشر خطوة بخطوة

### External Resources:
- [Baileys Documentation](https://github.com/WhiskeySockets/Baileys)
- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [PM2 Docs](https://pm2.keymetrics.io/docs)

---

## 🤝 المساهمة

نرحب بالمساهمات! الرجاء:

1. Fork المشروع
2. إنشاء Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit التغييرات (`git commit -m 'Add AmazingFeature'`)
4. Push إلى Branch (`git push origin feature/AmazingFeature`)
5. فتح Pull Request

---

## 📄 الترخيص

MIT License - استخدم المشروع بحرية في مشاريعك التجارية والشخصية.

---

## 💬 الدعم

إذا واجهت مشكلة أو لديك سؤال:

1. راجع [Troubleshooting](#-troubleshooting)
2. راجع [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
3. افتح Issue على GitHub
4. راسلنا على: support@example.com

---

## 🎉 شكراً!

تم بناء هذا المشروع بـ ❤️ لحل مشاكل WhatsApp CRM الشائعة.

**Happy Coding! 🚀**

</div>
