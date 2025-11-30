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
    if (!user || !firestore || isCreatingSession) return;
    setIsCreatingSession(true);

    try {
      // 1. Check for an existing session for the current user
      const sessionsQuery = query(
        collection(firestore, 'whatsappSessions'),
        where('ownerId', '==', user.uid),
        limit(1)
      );
      const querySnapshot = await getDocs(sessionsQuery);

      if (!querySnapshot.empty) {
        // Existing session found
        const existingSession = querySnapshot.docs[0];
        setSessionId(existingSession.id);
      } else {
        // 2. No session found, create a new one
        const sessionData = {
          ownerId: user.uid,
          isReady: false,
          qr: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const colRef = collection(firestore, 'whatsappSessions');
        const docRef = await addDoc(colRef, sessionData); // Use await here to get the ID
        setSessionId(docRef.id);
      }
    } catch (error) {
      console.error("Error finding or creating session:", error);
    } finally {
        setIsCreatingSession(false);
    }
  }, [user, firestore, isCreatingSession]);

  const refreshSession = async () => {
    if (!user || !firestore || !sessionId) return;
    try {
      const sessionDocRef = doc(firestore, 'whatsappSessions', sessionId);
      await updateDoc(sessionDocRef, {
        qr: '',
        isReady: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
       console.error("Error refreshing session:", error);
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
          <Button variant="destructive" disabled={connectionStatus !== 'connected'}>
            قطع الاتصال
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
