# 🚀 دليل النشر الكامل (Deployment Guide)

## 📋 متطلبات النشر

### 1. حسابات مطلوبة:
- ✅ حساب Supabase (مجاني)
- ✅ حساب Vercel (مجاني)
- ✅ حساب Firebase (اختياري)
- ✅ VPS أو Server لتشغيل Worker (مطلوب)

---

## 🗄️ 1. إعداد Supabase

### الخطوة 1: إنشاء مشروع جديد

```bash
# 1. اذهب إلى https://supabase.com
# 2. Create New Project
# 3. احفظ:
#    - Project URL
#    - anon/public key
#    - service_role key (من Settings > API)
```

### الخطوة 2: تطبيق Database Migrations

```bash
# في مجلد المشروع
cd your-project

# تثبيت Supabase CLI
npm install -g supabase

# ربط المشروع
supabase link --project-ref your-project-ref

# تطبيق الـ migrations
supabase db push

# أو يدوياً: انسخ SQL من ملفات migrations وشغلها في SQL Editor
```

### الخطوة 3: إعداد Row Level Security (RLS)

جميع الـ RLS policies موجودة في ملفات migration، لكن تأكد من:

```sql
-- تأكد من تفعيل RLS على جميع الجداول
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE jid_mappings ENABLE ROW LEVEL SECURITY;
```

### الخطوة 4: إعداد Storage (للصور والملفات)

```sql
-- إنشاء bucket للملفات
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true);

-- RLS للـ storage
CREATE POLICY "Anyone can view media"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media' AND auth.role() = 'authenticated');
```

---

## 🔧 2. إعداد Worker Service على VPS

### الخطوة 1: اختيار VPS

يمكنك استخدام:
- **DigitalOcean** (Droplet - $4/month)
- **Linode** (Nanode - $5/month)
- **AWS EC2** (t2.micro - Free tier)
- **Hetzner** (CX11 - €4/month)

**المواصفات المطلوبة:**
- CPU: 1 core
- RAM: 1GB minimum (2GB recommended)
- Storage: 20GB
- OS: Ubuntu 22.04 LTS

### الخطوة 2: تثبيت Node.js على VPS

```bash
# SSH إلى VPS
ssh root@your-vps-ip

# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# تثبيت npm & git
sudo apt install -y git npm

# تثبيت PM2 (Process Manager)
sudo npm install -g pm2

# التأكد من التثبيت
node --version  # v20.x.x
npm --version   # 10.x.x
pm2 --version   # 5.x.x
```

### الخطوة 3: نشر Worker على VPS

```bash
# إنشاء مجلد للمشروع
mkdir -p /var/www/whatsapp-worker
cd /var/www/whatsapp-worker

# Clone المشروع من GitHub
git clone https://github.com/your-repo/whatsapp-crm.git .

# الانتقال لمجلد Worker
cd worker-service

# تثبيت Dependencies
npm install

# إنشاء .env.local
nano .env.local
```

**محتوى .env.local:**
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
QR_REFRESH_INTERVAL=5000
QR_EXPIRY_TIME=300000
```

### الخطوة 4: تشغيل Worker بـ PM2

```bash
# بناء المشروع (إذا كان TypeScript)
npm run build  # اختياري

# تشغيل Worker بـ PM2
pm2 start npm --name "whatsapp-worker" -- start

# حفظ قائمة العمليات
pm2 save

# تفعيل PM2 عند إعادة تشغيل السيرفر
pm2 startup systemd

# التحقق من حالة Worker
pm2 status

# عرض Logs
pm2 logs whatsapp-worker

# إيقاف Worker
pm2 stop whatsapp-worker

# إعادة تشغيل Worker
pm2 restart whatsapp-worker
```

### الخطوة 5: إعداد Nginx Reverse Proxy (اختياري)

```bash
# تثبيت Nginx
sudo apt install -y nginx

# إنشاء ملف Config
sudo nano /etc/nginx/sites-available/worker

# محتوى الملف:
server {
    listen 80;
    server_name worker.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# تفعيل الموقع
sudo ln -s /etc/nginx/sites-available/worker /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## ☁️ 3. نشر Frontend على Vercel

### الخطوة 1: ربط GitHub بـ Vercel

```bash
# 1. اذهب إلى https://vercel.com
# 2. Import Git Repository
# 3. اختر مشروعك من GitHub
```

### الخطوة 2: إعداد Environment Variables في Vercel

في Vercel Dashboard > Settings > Environment Variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# WhatsApp Config
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-random-secure-token
QR_REFRESH_INTERVAL=5000
QR_EXPIRY_TIME=300000

# App Config
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
SESSION_SECRET=your-random-session-secret
```

### الخطوة 3: Build Settings

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

### الخطوة 4: Deploy

```bash
# النشر يحدث تلقائياً عند Push إلى GitHub

# أو يدوياً:
npm install -g vercel
vercel login
vercel --prod
```

---

## 🔗 4. إعداد WhatsApp Business API (اختياري)

إذا كنت تريد استخدام WhatsApp Business API بدلاً من Baileys:

### الخطوة 1: إنشاء Facebook App

```bash
# 1. اذهب إلى https://developers.facebook.com
# 2. Create App > Business
# 3. Add WhatsApp Product
```

### الخطوة 2: إعداد Webhook

```bash
# في WhatsApp > Configuration:
Callback URL: https://your-domain.vercel.app/api/webhook
Verify Token: your-random-secure-token

# Subscribe to:
- messages
- message_status
```

### الخطوة 3: الحصول على Access Token

```bash
# في WhatsApp > API Setup:
# 1. نسخ Phone Number ID
# 2. نسخ Temporary Access Token (تحتاج لتحويله إلى Permanent)

# إضافة إلى .env.local:
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-permanent-access-token
```

---

## 🧪 5. الاختبار

### اختبار Worker

```bash
# على VPS
pm2 logs whatsapp-worker --lines 100

# يجب أن ترى:
# ✅ "Starting WhatsApp Worker Service..."
# ✅ "Found X sessions"
# ✅ "QR Code generated"
```

### اختبار Frontend

```bash
# 1. افتح https://your-app.vercel.app/connect
# 2. يجب أن يظهر QR Code خلال 5 ثوانٍ
# 3. امسح QR بـ WhatsApp
# 4. يجب أن يتصل خلال ثوانٍ
# 5. تحويل إلى /chat تلقائياً
```

### اختبار Chat Duplication Fix

```bash
# 1. أرسل رسالة manual لرقم +201234567890
# 2. اطلب من الرقم الرد عليك
# 3. تحقق أن الرد ظهر في نفس الـ Chat (ليس chat جديد)

# في Supabase SQL Editor:
SELECT session_id, remote_id, name, COUNT(*) as count
FROM chats
GROUP BY session_id, remote_id, name
HAVING COUNT(*) > 1;

# يجب أن يرجع 0 rows (لا توجد duplicate chats)
```

---

## 🔄 6. التحديثات و Maintenance

### تحديث Worker على VPS

```bash
ssh root@your-vps-ip
cd /var/www/whatsapp-worker

# Pull آخر تحديثات
git pull origin main

# تثبيت Dependencies الجديدة
cd worker-service
npm install

# إعادة تشغيل Worker
pm2 restart whatsapp-worker

# التحقق
pm2 logs whatsapp-worker
```

### تحديث Frontend على Vercel

```bash
# Push إلى GitHub - Vercel يعمل deploy تلقائياً
git add .
git commit -m "Update: ..."
git push origin main

# الـ deployment يبدأ تلقائياً في Vercel
```

### Backup قاعدة البيانات

```bash
# في Supabase Dashboard > Database > Backups
# أو عبر CLI:
supabase db dump > backup-$(date +%Y%m%d).sql
```

---

## 📊 7. Monitoring & Logs

### PM2 Monitoring

```bash
# عرض Dashboard
pm2 monit

# عرض Logs فقط
pm2 logs whatsapp-worker

# حفظ Logs في ملف
pm2 logs whatsapp-worker > worker-logs.txt

# تنظيف Logs القديمة
pm2 flush
```

### Vercel Logs

```bash
# في Vercel Dashboard > Deployments > View Function Logs

# أو عبر CLI:
vercel logs your-app-name
```

### Supabase Logs

```bash
# في Supabase Dashboard > Logs
# - Postgres Logs
# - API Logs
# - Auth Logs
```

---

## 🛡️ 8. Security Best Practices

### 1. Environment Variables
```bash
# لا تضع أبداً credentials في الكود
# استخدم .env.local و .gitignore

echo ".env.local" >> .gitignore
echo "auth_info_baileys/" >> .gitignore
```

### 2. Supabase RLS
```sql
-- تأكد من تفعيل RLS على جميع الجداول
-- وإضافة policies صحيحة لكل جدول
```

### 3. Rate Limiting
```typescript
// في APIs, أضف rate limiting:
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

### 4. HTTPS Only
```bash
# في Vercel - HTTPS تلقائي
# للـ VPS - استخدم Certbot:

sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d worker.your-domain.com
```

---

## 🎯 9. ملخص الخطوات

1. ✅ إنشاء مشروع Supabase
2. ✅ تطبيق Database Migrations
3. ✅ استئجار VPS وتثبيت Node.js
4. ✅ نشر Worker على VPS بـ PM2
5. ✅ ربط GitHub بـ Vercel
6. ✅ ضبط Environment Variables
7. ✅ Deploy على Vercel
8. ✅ اختبار QR Code و Connections
9. ✅ اختبار عدم تكرار Chats
10. ✅ إعداد Monitoring

---

## 🆘 Troubleshooting

### مشكلة: QR لا يظهر

**الحل:**
```bash
# تحقق من Worker logs:
pm2 logs whatsapp-worker

# تأكد من أن Worker متصل بـ Supabase:
# يجب أن ترى: "✅ QR Code generated"
```

### مشكلة: Chats مكررة

**الحل:**
```sql
-- تحقق من الـ constraint:
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'chats'
AND constraint_type = 'UNIQUE';

-- يجب أن ترى: chats_session_remote_unique

-- إذا غير موجود:
ALTER TABLE chats
ADD CONSTRAINT chats_session_remote_unique
UNIQUE (session_id, remote_id);
```

### مشكلة: Worker يتوقف بعد فترة

**الحل:**
```bash
# تأكد من PM2 startup:
pm2 startup systemd
pm2 save

# زيادة memory limit:
pm2 start npm --name "whatsapp-worker" --max-memory-restart 500M -- start
```

---

**🎉 مبروك! مشروعك الآن جاهز للاستخدام!**
