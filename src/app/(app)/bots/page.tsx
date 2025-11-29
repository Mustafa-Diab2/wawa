'use client';
import { useState } from 'react';
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import BotCard from "@/components/bots/bot-card";
import BotForm from "@/components/bots/bot-form";
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import type { Bot } from '@/lib/types';
import { collection, query, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function BotsPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const [isDialogOpen, setDialogOpen] = useState(false);

  const botsQuery = useMemoFirebase(
    () =>
      user && firestore
        ? query(collection(firestore, `users/${user.uid}/bots`))
        : null,
    [firestore, user]
  );

  const { data: bots, isLoading: botsLoading } = useCollection<Bot>(botsQuery);

  const isLoading = isUserLoading || botsLoading;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            إدارة البوتات
          </h1>
          <p className="text-muted-foreground">
            أنشئ، عدّل، وفعّل البوتات لأتمتة محادثاتك.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              إنشاء بوت جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>إنشاء بوت جديد</DialogTitle>
              <DialogDescription>
                املأ التفاصيل لإنشاء بوت مخصص.
              </DialogDescription>
            </DialogHeader>
            <BotForm onFormSubmit={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
        </div>
      ) : bots && bots.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">لم تقم بإنشاء أي بوتات بعد.</p>
            <p className="text-sm text-muted-foreground">انقر على "إنشاء بوت جديد" للبدء.</p>
        </div>
      )}
    </div>
  );
}
