# نشر التطبيق (Deployment)

## المشكلة
الـ Worker يحتاج أن يعمل 24/7 لاستقبال رسائل WhatsApp، لكن Vercel لا تدعم long-running processes.

## الحل: استخدام Railway.app للـ Worker

### الخطوات:

#### 1. إنشاء حساب على Railway
1. اذهب إلى [railway.app](https://railway.app)
2. سجل دخول باستخدام GitHub

#### 2. إنشاء مشروع جديد
1. اضغط "New Project"
2. اختر "Deploy from GitHub repo"
3. اختر repository: `Mustafa-Diab2/wawa`
4. اختر branch: `main`

#### 3. إضافة Environment Variables
أضف المتغيرات التالية في Railway:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
ANTHROPIC_API_KEY=your_anthropic_api_key
```

#### 4. تعديل Start Command
في Railway Settings → Deploy:
- **Start Command**: `npm run worker`
- **Watch Paths**: اتركها فارغة (أو احذفها)

#### 5. Deploy
اضغط "Deploy" وانتظر حتى ينتهي البناء

#### 6. التحقق
- افتح Logs في Railway
- يجب أن ترى: `[Worker] ✅ Found X existing sessions`
- يجب أن ترى: `QR RECEIVED for session...`

---

## البديل: استخدام Render.com (مجاني أيضاً)

### الخطوات:

1. اذهب إلى [render.com](https://render.com)
2. سجل دخول باستخدام GitHub
3. اضغط "New +" → "Background Worker"
4. اختر repository: `Mustafa-Diab2/wawa`
5. أضف Environment Variables (نفس القيم أعلاه)
6. **Start Command**: `npm run worker`
7. اختر Free plan
8. اضغط "Create Background Worker"

---

## ملاحظات مهمة

### 1. الـ Frontend يبقى على Vercel
- الموقع الرئيسي يعمل على Vercel: `https://wawa-khaki.vercel.app`
- فقط الـ Worker ينتقل لـ Railway/Render

### 2. Supabase Realtime
- تأكد أن Supabase Realtime مفعل
- تأكد أن Row Level Security (RLS) يسمح للـ Worker بالقراءة والكتابة

### 3. Auth Files
- الـ Worker يحفظ auth files في `/auth_info_baileys`
- على Railway/Render، هذه الملفات ستُحذف عند إعادة التشغيل
- يمكن استخدام Volumes لحفظها (مدفوع)

### 4. التكلفة
- **Railway**: مجاني حتى $5/شهر usage
- **Render**: مجاني لكن ينام بعد 15 دقيقة خمول (غير مناسب للـ Worker)
- **الأفضل**: Railway

---

## الحل المؤقت (Development)

إذا كنت تريد التجربة محلياً:
1. شغل Worker محلياً: `npm run worker`
2. افتح التطبيق على: `http://localhost:3000`
3. QR سيظهر مباشرة

---

## استكشاف الأخطاء

### Worker لا يبدأ
- تحقق من logs في Railway/Render
- تأكد أن Environment Variables صحيحة
- تأكد أن `npm run worker` يعمل محلياً

### QR لا يظهر
- تحقق أن Worker يعمل (انظر logs)
- تحقق أن Supabase Realtime مفعل
- جرب تحديث الصفحة

### الرسائل لا تُرسل
- تأكد أن Worker متصل بـ WhatsApp (QR تم مسحه)
- تحقق من logs: `[Worker] Sending message...`
- تأكد من RLS policies في Supabase
