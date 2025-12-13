'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import WhatsAppIcon from '@/components/icons/whatsapp-icon';


interface SessionData {
  id: string;
  owner_id: string;
  qr: string;
  is_ready: boolean;
  should_disconnect: boolean;
  created_at: string;
  updated_at: string;
}

export default function ConnectPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [lastValidQR, setLastValidQR] = useState<string>(''); // Keep last valid QR
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  // Get or create anonymous user
  useEffect(() => {
    const initUser = async () => {
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();

        if (authSession?.user) {
          setUserId(authSession.user.id);
        } else {
          // Sign in anonymously
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          setUserId(data.session?.user.id || null);
        }
      } catch (error) {
        console.error('Error initializing user:', error);
      }
    };

    initUser();
  }, []);

  // Function to find an existing session or create a new one
  const findOrCreateSession = useCallback(async () => {
    console.log('[findOrCreateSession] Called with:', {
      hasUserId: !!userId,
      userId,
      isCreatingSession
    });

    if (!userId || isCreatingSession) {
      console.log('[findOrCreateSession] Early return - missing requirements');
      return;
    }
    setIsCreatingSession(true);

    try {
      // 1. Check for an existing session for the current user
      console.log('[findOrCreateSession] Querying for existing sessions for user:', userId);
      const { data: existingSessions, error: queryError } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('owner_id', userId)
        .limit(1);

      if (queryError) throw queryError;

      if (existingSessions && existingSessions.length > 0) {
        // Existing session found
        const existingSession = existingSessions[0];
        console.log('[findOrCreateSession] Existing session found:', {
          sessionId: existingSession.id,
          isReady: existingSession.is_ready,
          hasQR: !!existingSession.qr,
          qrLength: existingSession.qr?.length || 0,
          shouldDisconnect: existingSession.should_disconnect
        });
        setSessionId(existingSession.id);
        setSession(existingSession);
        // Cache sessionId in localStorage
        localStorage.setItem(`whatsapp_session_${userId}`, existingSession.id);
      } else {
        // 2. No session found, create a new one
        console.log('[findOrCreateSession] No existing session, creating new session for user:', userId);
        const { data: newSession, error: insertError } = await supabase
          .from('whatsapp_sessions')
          .insert({
            owner_id: userId,
            is_ready: false,
            qr: '',
          })
          .select()
          .single();

        if (insertError) throw insertError;

        console.log('[findOrCreateSession] New session created with ID:', newSession.id);
        setSessionId(newSession.id);
        setSession(newSession);
        // Cache sessionId in localStorage
        localStorage.setItem(`whatsapp_session_${userId}`, newSession.id);
      }
    } catch (error) {
      console.error("[findOrCreateSession] Error finding or creating session:", error);
    } finally {
      setIsCreatingSession(false);
      setIsLoading(false);
      console.log('[findOrCreateSession] Completed');
    }
  }, [userId, isCreatingSession]);

  const refreshSession = async () => {
    console.log('[refreshSession] Called with:', {
      hasUserId: !!userId,
      userId,
      sessionId
    });

    if (!userId || !sessionId) {
      console.log('[refreshSession] Early return - missing requirements');
      return;
    }

    try {
      console.log('[refreshSession] Updating session document:', sessionId);
      const { error } = await supabase
        .from('whatsapp_sessions')
        .update({
          qr: '',
          is_ready: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;
      console.log('[refreshSession] Session document updated successfully');
    } catch (error) {
      console.error("[refreshSession] Error refreshing session:", error);
    }
  };

  const disconnectSession = async () => {
    console.log('[disconnectSession] Called with:', {
      hasUserId: !!userId,
      userId,
      sessionId
    });

    if (!userId || !sessionId) {
      console.log('[disconnectSession] Early return - missing requirements');
      return;
    }

    try {
      console.log('[disconnectSession] Updating session document to trigger disconnect:', sessionId);
      // This will trigger the worker to logout and clear the session
      const { error } = await supabase
        .from('whatsapp_sessions')
        .update({
          qr: '',
          is_ready: false,
          should_disconnect: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (error) throw error;
      console.log('[disconnectSession] Session document updated successfully');

      // Clear cached sessionId from localStorage
      localStorage.removeItem(`whatsapp_session_${userId}`);

      // Reset local state
      setSessionId(null);
      setSession(null);

      // Create new session after disconnect
      console.log('[disconnectSession] Creating new session after disconnect...');
      setTimeout(() => {
        findOrCreateSession();
      }, 2000); // Wait 2 seconds for worker to cleanup
    } catch (error) {
      console.error("[disconnectSession] Error disconnecting session:", error);
    }
  };

  // Effect to verify cached session or create new one
  useEffect(() => {
    const verifyOrCreateSession = async () => {
      if (!userId || sessionId || isCreatingSession) return;

      // If we have a cached sessionId, verify it exists in database
      const cachedSessionId = localStorage.getItem(`whatsapp_session_${userId}`);
      if (cachedSessionId) {
        console.log('[verifyOrCreateSession] Verifying cached session:', cachedSessionId);
        const { data: existingSession, error } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('id', cachedSessionId)
          .eq('owner_id', userId)
          .single();

        if (!error && existingSession) {
          console.log('[verifyOrCreateSession] Cached session is valid');
          setSessionId(existingSession.id);
          setSession(existingSession);
          setIsLoading(false);
          return;
        } else {
          console.log('[verifyOrCreateSession] Cached session is invalid, removing from cache');
          localStorage.removeItem(`whatsapp_session_${userId}`);
        }
      }

      // No valid cached session, create or find one
      findOrCreateSession();
    };

    verifyOrCreateSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Effect to subscribe to session changes via Realtime
  useEffect(() => {
    if (!sessionId) return;

    console.log('[ConnectPage] Setting up realtime subscription for session:', sessionId);

    const realtimeChannel = supabase
      .channel(`session-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whatsapp_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          // Update session state from realtime
          setSession(payload.new as SessionData);
        }
      )
      .subscribe();

    setChannel(realtimeChannel);

    // Fetch immediately on mount
    const fetchSession = async () => {
      try {
        const { data, error } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (!error && data) {
          console.log('[ConnectPage] Fetched session:', {
            hasQR: !!data.qr,
            qrLength: data.qr?.length || 0,
            isReady: data.is_ready
          });

          // Keep last valid QR code
          if (data.qr && data.qr.length > 0) {
            setLastValidQR(data.qr);
          }

          setSession(data as SessionData);
        }
      } catch (error) {
        console.error('[ConnectPage] Fetch error:', error);
      }
    };

    // Fetch immediately
    fetchSession();

    // Polling as backup for Realtime
    const pollInterval = setInterval(fetchSession, 2000); // Poll every 2 seconds

    return () => {
      realtimeChannel.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [sessionId]);

  // Log only important session state changes
  useEffect(() => {
    if (session?.is_ready) {
      console.log('[ConnectPage] ✅ Session connected:', sessionId);
    }
  }, [session?.is_ready, sessionId]);

  const connectionStatus = session?.is_ready ? "connected" : "disconnected";
  // Use lastValidQR if current QR is empty
  const displayQR = (session?.qr && session.qr.length > 0) ? session.qr : lastValidQR;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(displayQR)}`;

  const renderStatus = () => {
    if (isLoading) {
       return (
          <Badge variant="secondary" className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري التحميل...
          </Badge>
        );
    }

    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge className="bg-green-500 hover:bg-green-600 gap-2">
            <CheckCircle className="h-4 w-4" />
            متصل
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="destructive" className="gap-2">
            <XCircle className="h-4 w-4" />
            غير متصل
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center items-center">
          <WhatsAppIcon className="h-12 w-12 text-green-500 mb-2" />
          <CardTitle className="font-headline text-2xl">ربط حساب WhatsApp</CardTitle>
          <CardDescription>
            امسح رمز الاستجابة السريعة (QR) باستخدام تطبيق WhatsApp على هاتفك.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="p-4 bg-white rounded-lg shadow-inner h-[232px] w-[232px] flex items-center justify-center">
            {displayQR && !session?.is_ready ? (
              <Image
                src={qrCodeUrl}
                alt="QR Code"
                width={200}
                height={200}
                unoptimized
                key={displayQR}
              />
            ) : (
              <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-100 rounded-md">
                {isLoading ? (
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                ) : session?.is_ready ? (
                  <CheckCircle className="h-16 w-16 text-green-500" />
                ) : (
                   <p className="text-sm text-muted-foreground text-center p-4">جاري إنشاء الرمز...</p>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">الحالة:</span>
            {renderStatus()}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
           <Button variant="outline" className="gap-2" onClick={refreshSession} disabled={isLoading}>
            <RefreshCw className="h-4 w-4" />
            تحديث الرمز
          </Button>
          <Button variant="destructive" disabled={connectionStatus !== 'connected'} onClick={disconnectSession}>
            قطع الاتصال
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
