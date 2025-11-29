import { PlusCircle, Search, FileDown } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { mockContacts, mockCategories } from "@/lib/mock-data";

export default function ContactsTable() {
    const getCategoryName = (id: string | null) => {
        return mockCategories.find(c => c.id === id)?.name || '-';
    }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
            <div>
                <CardTitle>قائمة جهات الاتصال</CardTitle>
                <CardDescription>
                    إدارة جهات اتصال العملاء الخاصة بك.
                </CardDescription>
            </div>
            <div className='flex gap-2'>
                 <Button variant="outline" size="sm" className="gap-2">
                    <FileDown className="h-4 w-4" />
                    تصدير
                </Button>
                <Button size="sm" className="gap-2">
                    <PlusCircle className="h-4 w-4" />
                    إضافة جهة اتصال
                </Button>
            </div>
        </div>
        <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث عن جهة اتصال..." className="pl-9" />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الاسم</TableHead>
              <TableHead>رقم الهاتف</TableHead>
              <TableHead>البريد الإلكتروني</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockContacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={contact.avatar} alt={contact.name} />
                      <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{contact.name}</span>
                  </div>
                </TableCell>
                <TableCell>{contact.phone}</TableCell>
                <TableCell>{contact.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{getCategoryName(contact.categoryId)}</Badge>
                </TableCell>
                <TableCell className="text-left">
                  <Button variant="ghost" size="sm">تعديل</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
