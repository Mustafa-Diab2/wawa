# 🎨 Frontend Components - Complete Implementation

## src/components/QRScanner.tsx

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';

interface QRScannerProps {
  sessionId: string;
  onConnected?: () => void;
  refreshInterval?: number; // milliseconds (default: 5000)
}

export default function QRScanner({
  sessionId,
  onConnected,
  refreshInterval = 5000
}: QRScannerProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [lastQr, setLastQr] = useState<string>(''); // Keep last valid QR
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  /**
   * Fetch QR Code from API
   */
  const fetchQR = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/qr?sessionId=${sessionId}&format=text&t=${Date.now()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch QR');
      }

      const data = await response.json();

      if (data.connected) {
        setIsConnected(true);
        setQr(null);
        onConnected?.();
        return;
      }

      if (data.qr) {
        setQr(data.qr);
        setLastQr(data.qr); // Save last valid QR
        setError(null);

        // Calculate countdown
        if (data.qr_expires_at) {
          const expiresAt = new Date(data.qr_expires_at).getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
          setCountdown(remaining);
        }
      } else if (data.expired) {
        setError('QR expired. Generating new one...');
      } else {
        setError(data.message || 'Waiting for QR...');
      }

    } catch (err) {
      console.error('Error fetching QR:', err);
      setError('Failed to load QR code');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, onConnected]);

  /**
   * Auto-refresh QR every X seconds
   */
  useEffect(() => {
    if (isConnected) return;

    fetchQR();

    const interval = setInterval(fetchQR, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchQR, refreshInterval, isConnected]);

  /**
   * Countdown timer
   */
  useEffect(() => {
    if (countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown]);

  /**
   * Generate QR Code URL
   */
  const getQRImageUrl = (qrText: string) => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrText)}&t=${Date.now()}`;
  };

  // Display QR (use last valid QR if current is null)
  const displayQR = qr || lastQr;

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
        <svg
          className="w-10 h-10 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          ربط حساب WhatsApp
        </h2>
        <p className="text-gray-600">
          امسح رمز الاستجابة السريعة (QR) باستخدام تطبيق WhatsApp على هاتفك
        </p>
      </div>

      {isConnected ? (
        <div className="flex flex-col items-center space-y-4 p-8 bg-green-50 rounded-lg border-2 border-green-200">
          <CheckCircle2 className="w-16 h-16 text-green-600" />
          <div className="text-center">
            <h3 className="text-xl font-semibold text-green-900">
              متصل بنجاح!
            </h3>
            <p className="text-green-700 mt-2">
              حسابك على WhatsApp متصل الآن
            </p>
          </div>
        </div>
      ) : (
        <>
          {isLoading && !displayQR ? (
            <div className="flex flex-col items-center space-y-4 p-8">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
              <p className="text-gray-600">جاري توليد رمز QR...</p>
            </div>
          ) : error && !displayQR ? (
            <div className="flex flex-col items-center space-y-4 p-8 bg-yellow-50 rounded-lg border-2 border-yellow-200">
              <RefreshCw className="w-12 h-12 text-yellow-600 animate-spin" />
              <p className="text-yellow-800 font-medium">{error}</p>
            </div>
          ) : displayQR ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="relative p-4 bg-white rounded-lg shadow-lg border-2 border-gray-200">
                <Image
                  src={getQRImageUrl(displayQR)}
                  alt="QR Code"
                  width={300}
                  height={300}
                  unoptimized
                  key={displayQR} // Force re-render when QR changes
                  className="rounded-md"
                />

                {countdown > 0 && (
                  <div className="absolute top-2 right-2 bg-black/70 text-white px-3 py-1 rounded-full text-sm">
                    {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>

              <div className="text-center text-sm text-gray-500">
                <p>سيتم تجديد رمز QR تلقائياً كل {refreshInterval / 1000} ثانية</p>
                {countdown > 0 && (
                  <p className="mt-1 text-xs">
                    ينتهي خلال {countdown} ثانية
                  </p>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}

      <div className="max-w-md text-center space-y-2 text-sm text-gray-600">
        <p className="font-semibold">كيفية المسح:</p>
        <ol className="text-right list-decimal list-inside space-y-1">
          <li>افتح WhatsApp على هاتفك</li>
          <li>انتقل إلى الإعدادات &gt; الأجهزة المرتبطة</li>
          <li>اضغط على &quot;ربط جهاز&quot;</li>
          <li>وجّه كاميرا هاتفك نحو الشاشة لمسح الرمز</li>
        </ol>
      </div>
    </div>
  );
}
```

## src/app/(app)/connect/page.tsx

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import QRScanner from '@/components/QRScanner';
import { Button } from '@/components/ui/button';

export default function ConnectPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initUser();
  }, []);

  async function initUser() {
    try {
      // Get or create anonymous user
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUserId(session.user.id);
        await findOrCreateSession(session.user.id);
      } else {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;

        setUserId(data.session?.user.id || null);
        if (data.session?.user.id) {
          await findOrCreateSession(data.session.user.id);
        }
      }
    } catch (error) {
      console.error('Error initializing user:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function findOrCreateSession(userId: string) {
    try {
      // Check for existing session
      const { data: existing } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('owner_id', userId)
        .single();

      if (existing) {
        setSessionId(existing.id);
        return;
      }

      // Create new session via API
      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      const result = await response.json();

      if (result.success) {
        setSessionId(result.session.id);
      }
    } catch (error) {
      console.error('Error finding/creating session:', error);
    }
  }

  function handleConnected() {
    console.log('✅ WhatsApp connected!');
    // Redirect to chat page after 2 seconds
    setTimeout(() => {
      router.push('/chat');
    }, 2000);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">فشل في إنشاء الجلسة</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto">
        <QRScanner
          sessionId={sessionId}
          onConnected={handleConnected}
          refreshInterval={5000}
        />
      </div>
    </div>
  );
}
```

## src/lib/session.ts (Session Persistence Helper)

```typescript
/**
 * Session Management for WebView
 * Handles cookies and session persistence
 */

export class SessionStorage {
  private static STORAGE_KEY = 'whatsapp_session_data';

  /**
   * Save session to localStorage
   */
  static save(sessionId: string, data: any) {
    try {
      const sessionData = {
        sessionId,
        data,
        timestamp: Date.now()
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(sessionData));
      console.log('✅ Session saved to localStorage');
    } catch (error) {
      console.error('❌ Failed to save session:', error);
    }
  }

  /**
   * Load session from localStorage
   */
  static load(): { sessionId: string; data: any } | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);

      if (!stored) return null;

      const parsed = JSON.parse(stored);

      // Check if session is older than 7 days
      const age = Date.now() - parsed.timestamp;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

      if (age > maxAge) {
        this.clear();
        return null;
      }

      return {
        sessionId: parsed.sessionId,
        data: parsed.data
      };
    } catch (error) {
      console.error('❌ Failed to load session:', error);
      return null;
    }
  }

  /**
   * Clear session
   */
  static clear() {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('🗑️ Session cleared from localStorage');
  }

  /**
   * Check if session exists
   */
  static exists(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }
}

/**
 * Cookie Manager for WebView
 */
export class CookieManager {
  /**
   * Set cookie
   */
  static set(name: string, value: string, days: number = 7) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

    document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Strict`;
  }

  /**
   * Get cookie
   */
  static get(name: string): string | null {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');

    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }

    return null;
  }

  /**
   * Delete cookie
   */
  static delete(name: string) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  }
}
```

---

سأكمل في الملف التالي بدليل النشر...
