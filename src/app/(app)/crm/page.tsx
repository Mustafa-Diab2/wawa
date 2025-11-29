'use client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ContactsTable from "@/components/crm/contacts-table";
import CategoriesTable from "@/components/crm/categories-table";
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Contact, Category } from '@/lib/types';

export default function CrmPage() {
  const { user } = useUser();
  const firestore = useFirestore();

  const contactsQuery = useMemoFirebase(
    () => user && firestore ? query(collection(firestore, `users/${user.uid}/contacts`)) : null,
    [firestore, user]
  );
  const { data: contacts, isLoading: contactsLoading } = useCollection<Contact>(contactsQuery);

  const categoriesQuery = useMemoFirebase(
    () => user && firestore ? query(collection(firestore, `users/${user.uid}/categories`)) : null,
    [firestore, user]
  );
  const { data: categories, isLoading: categoriesLoading } = useCollection<Category>(categoriesQuery);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            إدارة علاقات العملاء (CRM)
          </h1>
          <p className="text-muted-foreground">
            أدِر جهات الاتصال والفئات الخاصة بك بكفاءة.
          </p>
        </div>
      </div>
      <Tabs defaultValue="contacts" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="contacts">جهات الاتصال</TabsTrigger>
          <TabsTrigger value="categories">الفئات</TabsTrigger>
        </TabsList>
        <TabsContent value="contacts">
          <ContactsTable contacts={contacts || []} categories={categories || []} isLoading={contactsLoading} />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTable categories={categories || []} isLoading={categoriesLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
