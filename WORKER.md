# WaCRM Worker Management

الـ Worker هو السيرفس اللي بيشتغل في الخلفية ويستقبل ويرسل رسائل WhatsApp.

## إدارة الـ Worker

### بدء تشغيل الـ Worker
```bash
npm run worker:start
```

### إيقاف الـ Worker
```bash
npm run worker:stop
```

### إعادة تشغيل الـ Worker
```bash
npm run worker:restart
```

### عرض حالة الـ Worker
```bash
npm run worker:status
```

### عرض Logs
```bash
npm run worker:logs
```

### حذف الـ Worker من PM2
```bash
npm run worker:delete
```

## معلومات إضافية

- **Process Manager**: PM2
- **Auto-restart**: مفعّل (في حالة حدوث خطأ)
- **Memory limit**: 500MB
- **Logs location**: `./logs/`

## Logs

- **Combined logs**: `./logs/worker-combined.log`
- **Error logs**: `./logs/worker-error.log`
- **Output logs**: `./logs/worker-out.log`

## Monitoring

لعرض معلومات تفصيلية عن الـ Worker:
```bash
pm2 monit
```

## Production Deployment

في الـ production، الـ Worker هيشتغل تلقائياً مع PM2 وهيعيد تشغيل نفسه في حالة:
- حدوث خطأ
- استهلاك ذاكرة أكثر من 500MB
- إعادة تشغيل السيرفر (إذا تم تفعيل PM2 startup)

## Troubleshooting

### إذا الـ Worker مش شغال:
```bash
pm2 status
pm2 logs wacrm-worker --lines 50
```

### إعادة تشغيل كاملة:
```bash
npm run worker:delete
npm run worker:start
```

### مسح جميع البيانات:
```bash
pm2 delete all
pm2 save --force
```
