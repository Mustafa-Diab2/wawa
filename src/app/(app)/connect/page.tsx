'use client';
import { useState, useEffect } from 'react';
import {
  doc,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import {
  useFirestore,
  useUser,
  useDoc,
  useMemoFirebase,
} from '@/firebase';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
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

  const sessionRef = useMemoFirebase(
    () => (sessionId ? doc(firestore, `whatsappSessions/${sessionId}`) : null),
    [firestore, sessionId]
  );

  const { data: session, isLoading: isSessionLoading } = useDoc<WhatsAppSession>(sessionRef);

  useEffect(() => {
    if (!user && !isUserLoading) {
      initiateAnonymousSignIn(auth);
    }
  }, [user, isUserLoading, auth]);

  const createSession = async () => {
    if (!user || !firestore) return;
    try {
      const sessionData = {
        ownerId: user.uid,
        isReady: false,
        qr: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const colRef = collection(firestore, 'whatsappSessions');
      const docRef = await addDocumentNonBlocking(colRef, sessionData);
      setSessionId(docRef.id);
    } catch (error) {
      console.error("Error creating session:", error);
    }
  };
  
  useEffect(() => {
    if (user && !sessionId && firestore) {
      createSession();
    }
  }, [user, sessionId, firestore]);
  

  const connectionStatus = session?.isReady ? "connected" : (isSessionLoading || !session) ? "loading" : "disconnected";
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(session?.qr || '')}`;

  const renderStatus = () => {
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
      case 'loading':
        return (
          <Badge variant="secondary" className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري الحصول على الرمز...
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
                {connectionStatus === 'connected' ? (
                  <CheckCircle className="h-16 w-16 text-green-500" />
                ) : (
                  <Loader2 className="h-16 w-16 animate-spin text-primary" />
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
          <Button variant="outline" className="gap-2" onClick={createSession} disabled={isSessionLoading}>
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
