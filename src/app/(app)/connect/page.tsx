'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
  updateDoc
} from 'firebase/firestore';
import {
  useFirestore,
  useUser,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
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
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { useAuth } from '@/firebase';
import type { WhatsAppSession } from '@/lib/types';


export default function ConnectPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Function to find an existing session or create a new one
  const findOrCreateSession = useCallback(async () => {
    console.log('[findOrCreateSession] Called with:', {
      hasUser: !!user,
      userId: user?.uid,
      hasFirestore: !!firestore,
      isCreatingSession
    });

    if (!user || !firestore || isCreatingSession) {
      console.log('[findOrCreateSession] Early return - missing requirements');
      return;
    }
    setIsCreatingSession(true);

    try {
      // 1. Check for an existing session for the current user
      console.log('[findOrCreateSession] Querying for existing sessions for user:', user.uid);
      const sessionsQuery = query(
        collection(firestore, 'whatsappSessions'),
        where('ownerId', '==', user.uid),
        limit(1)
      );
      const querySnapshot = await getDocs(sessionsQuery);

      if (!querySnapshot.empty) {
        // Existing session found
        const existingSession = querySnapshot.docs[0];
        const sessionData = existingSession.data();
        console.log('[findOrCreateSession] Existing session found:', {
          sessionId: existingSession.id,
          isReady: sessionData.isReady,
          hasQR: !!sessionData.qr,
          qrLength: sessionData.qr?.length || 0,
          shouldDisconnect: sessionData.shouldDisconnect
        });
        setSessionId(existingSession.id);
      } else {
        // 2. No session found, create a new one
        console.log('[findOrCreateSession] No existing session, creating new session for user:', user.uid);
        const sessionData = {
          ownerId: user.uid,
          isReady: false,
          qr: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const colRef = collection(firestore, 'whatsappSessions');
        const docRef = await addDoc(colRef, sessionData);
        console.log('[findOrCreateSession] New session created with ID:', docRef.id);
        setSessionId(docRef.id);
      }
    } catch (error) {
      console.error("[findOrCreateSession] Error finding or creating session:", error);
    } finally {
        setIsCreatingSession(false);
        console.log('[findOrCreateSession] Completed');
    }
  }, [user, firestore, isCreatingSession]);

  const refreshSession = async () => {
    console.log('[refreshSession] Called with:', {
      hasUser: !!user,
      userId: user?.uid,
      hasFirestore: !!firestore,
      sessionId
    });

    if (!user || !firestore || !sessionId) {
      console.log('[refreshSession] Early return - missing requirements');
      return;
    }

    try {
      console.log('[refreshSession] Updating session document:', sessionId);
      const sessionDocRef = doc(firestore, 'whatsappSessions', sessionId);
      await updateDoc(sessionDocRef, {
        qr: '',
        isReady: false,
        updatedAt: serverTimestamp(),
      });
      console.log('[refreshSession] Session document updated successfully');
    } catch (error) {
       console.error("[refreshSession] Error refreshing session:", error);
    }
  };

  const disconnectSession = async () => {
    console.log('[disconnectSession] Called with:', {
      hasUser: !!user,
      userId: user?.uid,
      hasFirestore: !!firestore,
      sessionId
    });

    if (!user || !firestore || !sessionId) {
      console.log('[disconnectSession] Early return - missing requirements');
      return;
    }

    try {
      console.log('[disconnectSession] Updating session document to trigger disconnect:', sessionId);
      const sessionDocRef = doc(firestore, 'whatsappSessions', sessionId);
      // This will trigger the worker to logout and clear the session
      await updateDoc(sessionDocRef, {
        qr: '',
        isReady: false,
        shouldDisconnect: true,
        updatedAt: serverTimestamp(),
      });
      console.log('[disconnectSession] Session document updated successfully');
    } catch (error) {
       console.error("[disconnectSession] Error disconnecting session:", error);
    }
  };

  // Effect to handle user login and session creation
  useEffect(() => {
    // If there's no user and auth isn't loading, sign in anonymously.
    if (!user && !isUserLoading && auth) {
      initiateAnonymousSignIn(auth);
    }

    // Once we have a user and firestore, find or create the session.
    if (user && firestore && !sessionId) {
      findOrCreateSession();
    }
  }, [user, isUserLoading, auth, firestore, sessionId, findOrCreateSession]);

  // Hook to get the session document in real-time
  const sessionRef = useMemoFirebase(
    () => (user && firestore && sessionId ? doc(firestore, `whatsappSessions/${sessionId}`) : null),
    [firestore, user, sessionId]
  );
  const { data: session, isLoading: isSessionLoading } = useDoc<WhatsAppSession>(sessionRef);

  // Log session state changes
  useEffect(() => {
    if (session) {
      console.log('[ConnectPage] Session state updated:', {
        sessionId,
        isReady: session.isReady,
        hasQR: !!session.qr,
        qrLength: session.qr?.length || 0,
        shouldDisconnect: session.shouldDisconnect
      });
    }
  }, [session, sessionId]);

  const isLoading = Boolean(isUserLoading || isCreatingSession || (sessionId && isSessionLoading));
  const connectionStatus = session?.isReady ? "connected" : "disconnected";
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(session?.qr || '')}`;

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
            {connectionStatus === 'disconnected' && session?.qr ? (
              <Image
                src={qrCodeUrl}
                alt="QR Code"
                width={200}
                height={200}
                unoptimized
              />
            ) : (
              <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-100 rounded-md">
                {isLoading ? (
                    <Loader2 className="h-16 w-16 animate-spin text-primary" />
                ) : connectionStatus === 'connected' ? (
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
