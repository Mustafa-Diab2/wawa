'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Bot } from '@/lib/types';
import { useFirestore, useUser, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

const botFormSchema = z.object({
  name: z.string().min(2, { message: "الاسم يجب أن يكون حرفين على الأقل." }),
  type: z.enum(['welcome', 'auto', 'survey', 'ai']),
  aiModel: z.string().optional(),
  aiPrompt: z.string().optional(),
});

type BotFormValues = z.infer<typeof botFormSchema>;

interface BotFormProps {
  bot?: Bot;
  onFormSubmit?: () => void;
}

export default function BotForm({ bot, onFormSubmit }: BotFormProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<BotFormValues>({
    resolver: zodResolver(botFormSchema),
    defaultValues: {
      name: bot?.name || '',
      type: bot?.type || 'welcome',
      aiModel: bot?.aiModel || 'gpt-4o-mini',
      aiPrompt: bot?.aiPrompt || '',
    },
  });

  const botType = form.watch('type');

  const onSubmit = async (values: BotFormValues) => {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    const botData = {
      ...values,
      userId: user.uid,
      updatedAt: serverTimestamp(),
      ...(bot ? {} : { createdAt: serverTimestamp(), isActive: true }),
    };

    try {
      if (bot && bot.id) {
        const botRef = doc(firestore, `users/${user.uid}/bots/${bot.id}`);
        setDocumentNonBlocking(botRef, botData, { merge: true });
      } else {
        const botsColRef = collection(firestore, `users/${user.uid}/bots`);
        await addDocumentNonBlocking(botsColRef, botData);
      }
      onFormSubmit?.();
    } catch (error) {
      console.error("Error saving bot:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="grid grid-cols-4 items-center gap-4">
              <FormLabel className="text-right">اسم البوت</FormLabel>
              <FormControl>
                <Input {...field} className="col-span-3" />
              </FormControl>
              <FormMessage className="col-span-4 text-right" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem className="grid grid-cols-4 items-center gap-4">
              <FormLabel className="text-right">نوع البوت</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="اختر نوع البوت" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="welcome">بوت ترحيب</SelectItem>
                  <SelectItem value="auto">رد تلقائي</SelectItem>
                  <SelectItem value="survey">استطلاع رأي</SelectItem>
                  <SelectItem value="ai">بوت ذكاء اصطناعي</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage className="col-span-4 text-right" />
            </FormItem>
          )}
        />
        {botType === 'ai' && (
          <>
            <FormField
              control={form.control}
              name="aiModel"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">نموذج AI</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                     <FormControl>
                        <SelectTrigger className="col-span-3">
                          <SelectValue placeholder="اختر نموذج" />
                        </SelectTrigger>
                     </FormControl>
                    <SelectContent>
                      <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                      <SelectItem value="gpt-4">gpt-4</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="col-span-4 text-right" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="aiPrompt"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-start gap-4">
                  <FormLabel className="text-right pt-2">موجه الأوامر (Prompt)</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="أنت مساعد خدمة عملاء..." className="col-span-3" />
                  </FormControl>
                  <FormMessage className="col-span-4 text-right" />
                </FormItem>
              )}
            />
          </>
        )}
        <DialogFooter>
          <Button type="submit" disabled={isSubmitting}>
             {isSubmitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
             {bot ? 'حفظ التغييرات' : 'إنشاء البوت'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
