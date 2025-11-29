'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import type { Category } from '@/lib/types';
import { useFirestore, useUser, addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

const categoryFormSchema = z.object({
  name: z.string().min(2, { message: "اسم الفئة يجب أن يكون حرفين على الأقل." }),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

interface CategoryFormProps {
  category?: Category | null;
  onFormSubmit?: () => void;
}

export default function CategoryForm({ category, onFormSubmit }: CategoryFormProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name || '',
    },
  });

  const onSubmit = async (values: CategoryFormValues) => {
    if (!user || !firestore) return;
    setIsSubmitting(true);

    const categoryData = {
      ...values,
      userId: user.uid,
      updatedAt: serverTimestamp(),
      ...(category ? {} : { createdAt: serverTimestamp() }),
    };

    try {
      if (category && category.id) {
        const categoryRef = doc(firestore, `users/${user.uid}/categories/${category.id}`);
        setDocumentNonBlocking(categoryRef, categoryData, { merge: true });
      } else {
        const categoriesColRef = collection(firestore, `users/${user.uid}/categories`);
        await addDocumentNonBlocking(categoriesColRef, categoryData);
      }
      onFormSubmit?.();
    } catch (error) {
      console.error("Error saving category:", error);
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
              <FormLabel className="text-right">اسم الفئة</FormLabel>
              <FormControl>
                <Input {...field} className="col-span-3" />
              </FormControl>
               <FormMessage className="col-span-3 col-start-2" />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={isSubmitting}>
             {isSubmitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
             {category ? 'حفظ التغييرات' : 'إنشاء الفئة'}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
