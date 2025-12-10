# WaCRM WhatsApp Worker Service

Worker service للتعامل مع WhatsApp باستخدام Baileys.

## نشر على Railway.app

### الخطوات:

1. **إنشاء حساب على Railway**
   - اذهب إلى https://railway.app
   - سجل دخول باستخدام GitHub

2. **إنشاء مشروع جديد**
   - اضغط على "New Project"
   - اختر "Deploy from GitHub repo"
   - اختر هذا المستودع
   - اختر مجلد `worker-service`

3. **إضافة المتغيرات البيئية**
   - في صفحة المشروع، اذهب إلى "Variables"
   - أضف المتغيرات التالية:
     ```
     SUPABASE_URL=your_supabase_url
     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
     GOOGLE_AI_API_KEY=your_google_ai_api_key
     ```

4. **إعداد الخدمة**
   - Railway سيكتشف Dockerfile تلقائياً
   - انتظر حتى ينتهي Build
   - Worker سيبدأ تلقائياً ويعمل 24/7

## التشغيل محلياً

```bash
# تثبيت المكتبات
npm install

# نسخ ملف البيئة
cp .env.example .env.local

# تعديل .env.local بالقيم الصحيحة

# تشغيل Worker
npm run dev
```

## الميزات

- ✅ توليد QR code تلقائياً
- ✅ استقبال وإرسال الرسائل
- ✅ AI Agent للرد التلقائي
- ✅ التحويل لخدمة العملاء
- ✅ دعم الميديا (صور، فيديو، صوت، ملفات)
- ✅ إعادة الاتصال التلقائي
