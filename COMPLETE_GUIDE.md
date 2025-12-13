# 🚀 WhatsApp CRM - دليل المشروع الكامل من الصفر

## 📋 نظرة عامة

مشروع WhatsApp CRM متكامل يحل جميع المشاكل التالية:
- ✅ QR Code يتجدد تلقائياً كل 5 ثوانٍ
- ✅ الردود التلقائية تظهر في نفس الشات (لا تفتح شات جديد)
- ✅ Session Management محفوظ في WebView
- ✅ دعم كامل لـ Supabase & Firebase
- ✅ Webhook لمعالجة الرسائل الواردة

---

## 🏗️ هيكل المشروع

```
whatsapp-crm/
├── README.md
├── package.json
├── .env.local
├── next.config.js
├── tsconfig.json
│
├── src/
│   ├── app/                    # Next.js 14 App Router
│   │   ├── api/
│   │   │   ├── qr/
│   │   │   │   └── route.ts    # API: توليد QR Code
│   │   │   ├── webhook/
│   │   │   │   └── route.ts    # Webhook: استقبال رسائل WhatsApp
│   │   │   ├── messages/
│   │   │   │   ├── send/route.ts        # إرسال رسالة
│   │   │   │   └── reply/route.ts       # الرد على رسالة
│   │   │   └── session/
│   │   │       ├── create/route.ts      # إنشاء جلسة جديدة
│   │   │       └── status/route.ts      # حالة الجلسة
│   │   │
│   │   ├── connect/
│   │   │   └── page.tsx        # صفحة QR Code
│   │   ├── chat/
│   │   │   └── page.tsx        # صفحة المحادثات
│   │   └── layout.tsx
│   │
│   ├── components/
│   │   ├── QRScanner.tsx       # مكون QR مع Auto-Refresh
│   │   ├── ChatWindow.tsx      # نافذة المحادثة
│   │   └── WebViewWrapper.tsx  # WebView مع Session Persistence
│   │
│   └── lib/
│       ├── supabase.ts         # Supabase Client
│       ├── firebase.ts         # Firebase Config
│       ├── whatsapp.ts         # WhatsApp Helper Functions
│       └── session.ts          # Session Management
│
├── worker-service/             # Worker منفصل لإدارة WhatsApp
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── worker.ts           # Main Worker
│   │   ├── qr-manager.ts       # QR Code Auto-Regeneration
│   │   ├── session-manager.ts  # Session Persistence
│   │   └── lib/
│   │       ├── supabaseAdmin.ts
│   │       └── baileys-config.ts
│   └── auth_info_baileys/      # WhatsApp Auth Files (gitignored)
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_sessions_table.sql
│   │   ├── 003_chats_table.sql
│   │   └── 004_messages_table.sql
│   └── functions/              # Edge Functions (optional)
│
└── firebase/
    ├── functions/              # Cloud Functions (optional)
    └── firestore.rules
```

---

## 📦 1. التثبيت والإعداد الأولي

### package.json (Root)

```json
{
  "name": "whatsapp-crm",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start",
    "worker": "cd worker-service && npm start",
    "worker:dev": "cd worker-service && npm run dev",
    "supabase:start": "supabase start",
    "supabase:migrate": "supabase db push"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@supabase/supabase-js": "^2.45.0",
    "firebase": "^10.13.0",
    "firebase-admin": "^12.3.0",
    "@whiskeysockets/baileys": "^6.7.8",
    "qrcode": "^1.5.3",
    "date-fns": "^3.6.0",
    "zustand": "^4.5.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "typescript": "^5",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10",
    "postcss": "^8"
  }
}
```

### .env.local

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Firebase (Optional - for additional features)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
FIREBASE_ADMIN_KEY=your-admin-key-json

# WhatsApp Config
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-random-secure-token
QR_REFRESH_INTERVAL=5000  # milliseconds (5 seconds)
QR_EXPIRY_TIME=300000     # milliseconds (5 minutes)

# App Config
NEXT_PUBLIC_APP_URL=https://your-domain.com
SESSION_SECRET=your-session-secret
```

---

## 🗄️ 2. Supabase Database Schema

### supabase/migrations/001_initial_schema.sql

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);
```

### supabase/migrations/002_sessions_table.sql

```sql
-- WhatsApp Sessions Table
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Session Status
    is_ready BOOLEAN DEFAULT FALSE,
    is_connected BOOLEAN DEFAULT FALSE,
    should_disconnect BOOLEAN DEFAULT FALSE,

    -- QR Code Management
    qr TEXT,
    qr_generated_at TIMESTAMPTZ,
    qr_expires_at TIMESTAMPTZ,
    qr_scan_count INTEGER DEFAULT 0,

    -- Session Data
    phone_number TEXT,
    device_name TEXT,
    platform TEXT,

    -- Connection Info
    last_connected_at TIMESTAMPTZ,
    last_disconnected_at TIMESTAMPTZ,
    disconnect_reason TEXT,

    -- Metadata
    auth_credentials JSONB,  -- Encrypted Baileys credentials
    session_data JSONB,      -- Additional session data

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_owner ON whatsapp_sessions(owner_id);
CREATE INDEX idx_sessions_ready ON whatsapp_sessions(is_ready);
CREATE INDEX idx_sessions_qr_expires ON whatsapp_sessions(qr_expires_at);

-- RLS
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions"
    ON public.whatsapp_sessions FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can update own sessions"
    ON public.whatsapp_sessions FOR UPDATE
    USING (auth.uid() = owner_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON whatsapp_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### supabase/migrations/003_chats_table.sql

```sql
-- Chats Table (المحادثات)
CREATE TABLE IF NOT EXISTS public.chats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES whatsapp_sessions(id) ON DELETE CASCADE NOT NULL,

    -- Chat Identifiers (CRITICAL for preventing duplicate chats)
    remote_id TEXT NOT NULL,        -- Primary JID (e.g., 201234567890@s.whatsapp.net)
    phone_jid TEXT,                 -- For LID mapping (e.g., 201234567890@lid)

    -- Chat Info
    name TEXT,
    avatar_url TEXT,
    type TEXT DEFAULT 'INDIVIDUAL',  -- INDIVIDUAL, GROUP

    -- Status
    status TEXT DEFAULT 'INBOX',     -- INBOX, DONE, ARCHIVED
    is_unread BOOLEAN DEFAULT FALSE,
    is_group BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT TRUE,
    is_muted BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,

    -- Last Message
    last_message TEXT,
    last_message_at TIMESTAMPTZ,

    -- Assignment
    assigned_to UUID REFERENCES auth.users(id),

    -- AI Mode
    mode TEXT DEFAULT 'ai',          -- ai, human
    needs_human BOOLEAN DEFAULT FALSE,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- UNIQUE CONSTRAINT: Prevents duplicate chats for same contact
    CONSTRAINT chats_session_remote_unique UNIQUE (session_id, remote_id)
);

-- Indexes
CREATE INDEX idx_chats_session ON chats(session_id);
CREATE INDEX idx_chats_remote_id ON chats(remote_id);
CREATE INDEX idx_chats_phone_jid ON chats(phone_jid);
CREATE INDEX idx_chats_status ON chats(status);
CREATE INDEX idx_chats_assigned ON chats(assigned_to);
CREATE INDEX idx_chats_last_message ON chats(last_message_at DESC);

-- RLS
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view chats from own sessions"
    ON public.chats FOR SELECT
    USING (
        session_id IN (
            SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update chats from own sessions"
    ON public.chats FOR UPDATE
    USING (
        session_id IN (
            SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()
        )
    );

CREATE TRIGGER update_chats_updated_at
    BEFORE UPDATE ON chats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### supabase/migrations/004_messages_table.sql

```sql
-- Messages Table (الرسائل)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE NOT NULL,

    -- Message Identifiers
    remote_id TEXT,                  -- WhatsApp message ID

    -- Content
    body TEXT,
    media_url TEXT,
    media_type TEXT,                 -- image, video, audio, document
    media_mime_type TEXT,

    -- Direction & Status
    from_me BOOLEAN DEFAULT FALSE,
    is_read BOOLEAN DEFAULT FALSE,
    is_delivered BOOLEAN DEFAULT FALSE,
    is_sent BOOLEAN DEFAULT FALSE,

    -- Sender Info (for groups)
    sender_jid TEXT,
    sender_name TEXT,

    -- Reply Info
    quoted_message_id UUID REFERENCES messages(id),
    quoted_message_body TEXT,

    -- AI Processing
    ai_processed BOOLEAN DEFAULT FALSE,
    ai_response TEXT,
    sentiment TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_remote_id ON messages(remote_id);
CREATE INDEX idx_messages_from_me ON messages(from_me);

-- RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from own chats"
    ON public.messages FOR SELECT
    USING (
        chat_id IN (
            SELECT id FROM chats WHERE session_id IN (
                SELECT id FROM whatsapp_sessions WHERE owner_id = auth.uid()
            )
        )
    );

CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- JID Mappings Table (for LID support)
CREATE TABLE IF NOT EXISTS public.jid_mappings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES whatsapp_sessions(id) ON DELETE CASCADE NOT NULL,
    lid_jid TEXT NOT NULL,           -- LID format (e.g., 123456@lid)
    phone_jid TEXT NOT NULL,         -- Phone format (e.g., 201234567890@s.whatsapp.net)
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT jid_mappings_unique UNIQUE (session_id, lid_jid)
);

CREATE INDEX idx_jid_mappings_session ON jid_mappings(session_id);
CREATE INDEX idx_jid_mappings_lid ON jid_mappings(lid_jid);
```

---

## 🔧 3. Worker Service (WhatsApp Connection Manager)

سأكمل في الرد التالي بسبب طول الكود...
