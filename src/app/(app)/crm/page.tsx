import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ContactsTable from "@/components/crm/contacts-table";
import CategoriesTable from "@/components/crm/categories-table";

export default function CrmPage() {
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
          <ContactsTable />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
