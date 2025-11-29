'use client';
import { Bot as BotIcon, Edit, MoreVertical, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Bot } from "@/lib/types";
import { useFirestore, useUser, deleteDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { doc } from "firebase/firestore";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import BotForm from "./bot-form";

interface BotCardProps {
  bot: Bot;
}

const botTypeTranslations: { [key in Bot['type']]: string } = {
    welcome: 'ترحيب',
    auto: 'رد تلقائي',
    survey: 'استطلاع',
    ai: 'ذكاء اصطناعي'
}

export default function BotCard({ bot }: BotCardProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isEditDialogOpen, setEditDialogOpen] = useState(false);

  const handleDelete = () => {
    if (!user || !firestore || !bot.id) return;
    if (window.confirm(`هل أنت متأكد أنك تريد حذف البوت "${bot.name}"؟`)) {
        const botRef = doc(firestore, `users/${user.uid}/bots/${bot.id}`);
        deleteDocumentNonBlocking(botRef);
    }
  }

  const handleToggleActive = (isActive: boolean) => {
    if (!user || !firestore || !bot.id) return;
    const botRef = doc(firestore, `users/${user.uid}/bots/${bot.id}`);
    updateDocumentNonBlocking(botRef, { isActive });
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <BotIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="font-headline text-lg">{bot.name}</CardTitle>
              <CardDescription>
                <Badge variant="secondary">{botTypeTranslations[bot.type]}</Badge>
              </CardDescription>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                <Edit className="mr-2 h-4 w-4" />
                تعديل
              </DropdownMenuItem>
               <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 h-10">
            {bot.aiPrompt || `بوت ${botTypeTranslations[bot.type]} لإدارة المحادثات.`}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <span className="text-sm font-medium">
          {bot.isActive ? "فعّال" : "غير فعّال"}
        </span>
        <Switch checked={bot.isActive} onCheckedChange={handleToggleActive} aria-label="تفعيل البوت" />
      </CardFooter>
    </Card>
     <Dialog open={isEditDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>تعديل البوت</DialogTitle>
            <DialogDescription>
              قم بتحديث تفاصيل البوت الخاص بك.
            </DialogDescription>
          </DialogHeader>
          <BotForm bot={bot} onFormSubmit={() => setEditDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
