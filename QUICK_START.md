# ⚡ Quick Start - ابدأ في 10 دقائق

<div dir="rtl">

## 🎯 ما الذي ستحصل عليه؟

نظام WhatsApp CRM كامل يحل جميع المشاكل:
- ✅ QR Code يتجدد تلقائياً كل 5 ثوانٍ
- ✅ لا توجد محادثات مكررة أبداً
- ✅ الردود التلقائية في نفس الشات
- ✅ Session محفوظ بشكل دائم

---

## 📥 الخطوة 1: التثبيت (دقيقة واحدة)

```bash
# Clone المشروع
git clone https://github.com/your-repo/whatsapp-crm.git
cd whatsapp-crm

# تثبيت Dependencies
npm install
cd worker-service && npm install && cd ..
```

---

## 🔑 الخطوة 2: إعداد Supabase (3 دقائق)

### أ. إنشاء مشروع Supabase

1. اذهب إلى https://supabase.com
2. Create New Project
3. احفظ:
   - Project URL
   - anon key
   - service_role key

### ب. تطبيق Database Schema

افتح **Supabase SQL Editor** والصق هذا الكود:

```sql
-- Enable UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions Table
CREATE TABLE public.whatsapp_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID,
    is_ready BOOLEAN DEFAULT FALSE,
    is_connected BOOLEAN DEFAULT FALSE,
    qr TEXT,
    qr_generated_at TIMESTAMPTZ,
    qr_expires_at TIMESTAMPTZ,
    phone_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chats Table (PREVENTS DUPLICATES)
CREATE TABLE public.chats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES whatsapp_sessions(id) ON DELETE CASCADE NOT NULL,
    remote_id TEXT NOT NULL,
    phone_jid TEXT,
    name TEXT,
    type TEXT DEFAULT 'INDIVIDUAL',
    status TEXT DEFAULT 'INBOX',
    is_unread BOOLEAN DEFAULT FALSE,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    mode TEXT DEFAULT 'ai',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- CRITICAL: Prevents duplicate chats
    CONSTRAINT chats_session_remote_unique UNIQUE (session_id, remote_id)
);

-- Messages Table
CREATE TABLE public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,
    remote_id TEXT,
    body TEXT,
    from_me BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chats_session ON chats(session_id);
CREATE INDEX idx_chats_remote_id ON chats(remote_id);
CREATE INDEX idx_messages_chat ON messages(chat_id);
```

**اضغط RUN ✅**

---

## ⚙️ الخطوة 3: إعداد Environment Variables (دقيقة واحدة)

```bash
# إنشاء .env.local
nano .env.local
```

**الصق هذا:**
```bash
# Supabase (من Supabase Dashboard > Settings > API)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# WhatsApp Config
QR_REFRESH_INTERVAL=5000
QR_EXPIRY_TIME=300000

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**احفظ وأغلق (Ctrl+X, Y, Enter)**

---

## 🚀 الخطوة 4: تشغيل المشروع (دقيقة واحدة)

### Terminal 1: Frontend

```bash
npm run dev
```

### Terminal 2: Worker

```bash
cd worker-service
npm start
```

**افتح المتصفح:**
```
http://localhost:3000/connect
```

---

## ✅ الخطوة 5: اختبار النظام (3 دقائق)

### Test 1: QR Code Generation

1. افتح http://localhost:3000/connect
2. انتظر 5 ثوانٍ - QR Code يجب أن يظهر ✅
3. QR يتجدد تلقائياً كل 5 ثوانٍ ✅
4. Countdown timer يعمل ✅

### Test 2: WhatsApp Connection

1. افتح WhatsApp على هاتفك
2. اذهب إلى: الإعدادات > الأجهزة المرتبطة > ربط جهاز
3. امسح QR Code
4. يجب أن ترى: "✅ متصل بنجاح!" خلال ثوانٍ
5. تحويل تلقائي إلى `/chat`

### Test 3: No Duplicate Chats

```bash
# افتح http://localhost:3000/chat
# أرسل رسالة manual لرقم: +201234567890
# اطلب من الرقم الرد عليك
# تحقق: الرد يظهر في نفس الشات (ليس شات جديد) ✅
```

### Test 4: Verify in Database

```sql
-- في Supabase SQL Editor:
SELECT session_id, remote_id, name, COUNT(*)
FROM chats
GROUP BY session_id, remote_id, name
HAVING COUNT(*) > 1;

-- Result: 0 rows ✅ (No duplicates!)
```

---

## 🎉 تهانينا!

المشروع يعمل الآن! 🚀

### الخطوات التالية:

1. **تخصيص Auto-Reply:**
   - عدّل `worker-service/src/worker.ts`
   - دالة `handleAutoReply()`
   - أضف AI/GPT integration

2. **إضافة Features:**
   - Media support (صور، فيديوهات، ملفات)
   - Group chats
   - Message templates
   - Analytics dashboard

3. **النشر على Production:**
   - راجع [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
   - Frontend على Vercel
   - Worker على VPS (DigitalOcean, AWS, etc.)

---

## 🆘 مشاكل شائعة

### Problem: QR لا يظهر

**Solution:**
```bash
# تحقق من Worker logs:
cd worker-service
npm start

# يجب أن ترى:
# ✅ "Starting WhatsApp Worker Service..."
# ✅ "QR RECEIVED for session..."
```

### Problem: Worker يتوقف

**Solution:**
```bash
# استخدم PM2 (Production):
npm install -g pm2
cd worker-service
pm2 start npm --name "worker" -- start
pm2 save
```

### Problem: Chats مكررة

**Solution:**
```sql
-- تحقق من constraint:
SELECT constraint_name
FROM information_schema.table_constraints
WHERE table_name = 'chats'
AND constraint_type = 'UNIQUE';

-- يجب أن ترى: chats_session_remote_unique

-- إذا غير موجود:
ALTER TABLE chats
ADD CONSTRAINT chats_session_remote_unique
UNIQUE (session_id, remote_id);
```

---

## 📚 الوثائق الكاملة

- [COMPLETE_PROJECT_README.md](COMPLETE_PROJECT_README.md) - نظرة شاملة
- [COMPLETE_GUIDE.md](COMPLETE_GUIDE.md) - هيكل المشروع
- [WORKER_MAIN_CODE.md](WORKER_MAIN_CODE.md) - كود Worker
- [BACKEND_APIs_GUIDE.md](BACKEND_APIs_GUIDE.md) - APIs
- [FRONTEND_COMPONENTS_GUIDE.md](FRONTEND_COMPONENTS_GUIDE.md) - Components
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - النشر

---

## 🎯 ملخص سريع

```bash
# 1. Clone
git clone https://github.com/your-repo/whatsapp-crm.git
cd whatsapp-crm && npm install
cd worker-service && npm install && cd ..

# 2. Setup Supabase
# - Create project on supabase.com
# - Run SQL from QUICK_START.md

# 3. Create .env.local
# - Add Supabase credentials

# 4. Run
# Terminal 1: npm run dev
# Terminal 2: cd worker-service && npm start

# 5. Test
# Open http://localhost:3000/connect
```

**🚀 Done in 10 minutes!**

</div>
