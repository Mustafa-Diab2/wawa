import { PlusCircle } from 'lucide-react';
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
import { Badge } from "@/components/ui/badge";
import { mockCategories } from "@/lib/mock-data";

export default function CategoriesTable() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle>قائمة الفئات</CardTitle>
                <CardDescription>
                    تنظيم جهات الاتصال الخاصة بك في فئات.
                </CardDescription>
            </div>
            <Button size="sm" className="gap-2">
                <PlusCircle className="h-4 w-4" />
                إضافة فئة
            </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>اسم الفئة</TableHead>
              <TableHead className='text-left'>الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockCategories.map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  <Badge variant="outline">{category.name}</Badge>
                </TableCell>
                <TableCell className="text-left">
                  <Button variant="ghost" size="sm">تعديل</Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">حذف</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
