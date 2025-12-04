'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Contact, Category } from '@/lib/types';
import { Loader2 } from 'lucide-react';

const contactFormSchema = z.object({
  name: z.string().min(2, { message: "الاسم يجب أن يكون حرفين على الأقل." }),
  phone: z.string().min(9, { message: "رقم الهاتف غير صالح." }),
  email: z.string().email({ message: "البريد الإلكتروني غير صالح." }).optional().or(z.literal('')),
  categoryId: z.string().optional().nullable(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

interface ContactFormProps {
  contact?: Contact | null;
  categories: Category[];
  onFormSubmit?: () => void;
}

export default function ContactForm({ contact, categories, onFormSubmit }: ContactFormProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: contact?.name || '',
      phone: contact?.phone || '',
      email: contact?.email || '',
      categoryId: contact?.categoryId || null,
    },
  });

  const onSubmit = async (values: ContactFormValues) => {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    const contactData = {
      ...values,
      userId: user.uid,
      avatar: `https://i.pravatar.cc/150?u=${values.phone}`, // Generate avatar from phone
      updatedAt: serverTimestamp(),
      ...(contact ? {} : { createdAt: serverTimestamp() }),
    };

    try {
      if (contact && contact.id) {
        const contactRef = doc(firestore, `users/${user.uid}/contacts/${contact.id}`);
        setDocumentNonBlocking(contactRef, contactData, { merge: true });
      } else {
        const contactsColRef = collection(firestore, `users/${user.uid}/contacts`);
        await addDocumentNonBlocking(contactsColRef, contactData);
      }
      onFormSubmit?.();
    } catch (error) {
      console.error("Error saving contact:", error);
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
              <FormLabel className="text-right">الاسم</FormLabel>
              <FormControl>
                <Input {...field} className="col-span-3" />
              </FormControl>
              <FormMessage className="col-span-3 col-start-2" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem className="grid grid-cols-4 items-center gap-4">
              <FormLabel className="text-right">رقم الهاتف</FormLabel>
              <FormControl>
                <Input {...field} className="col-span-3" />
              </FormControl>
              <FormMessage className="col-span-3 col-start-2" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="grid grid-cols-4 items-center gap-4">
              <FormLabel className="text-right">البريد الإلكتروني</FormLabel>
              <FormControl>
                <Input {...field} className="col-span-3" />
              </FormControl>
              <FormMessage className="col-span-3 col-start-2" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem className="grid grid-cols-4 items-center gap-4">
              <FormLabel className="text-right">الفئة</FormLabel>
                <Select onValueChange={(val) => field.onChange(val === "none" ? null : val)} defaultValue={field.value || "none"}>
                     <FormControl>
                        <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="اختر فئة (اختياري)" />
                        </SelectTrigger>
                     </FormControl>
                    <SelectContent>
                        <SelectItem value="none"><em>بدون فئة</em></SelectItem>
                        {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              <FormMessage className="col-span-3 col-start-2" />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={isSubmitting}>
             {isSubmitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
             {contact ? 'حفظ التغييرات' : 'إنشاء جهة اتصال'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
