'use client';
import { useState } from 'react';
import { PlusCircle, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Category } from "@/lib/types";
import { Skeleton } from '../ui/skeleton';
import CategoryForm from './category-form';

interface CategoriesTableProps {
    categories: Category[];
    isLoading: boolean;
}

export default function CategoriesTable({ categories, isLoading }: CategoriesTableProps) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setFormOpen(true);
    }
    
    const handleAddNew = () => {
        setEditingCategory(null);
        setFormOpen(true);
    }

    const handleDelete = (category: Category) => {
        if (!user || !firestore || !category.id) return;
        if(window.confirm(`هل أنت متأكد أنك تريد حذف الفئة "${category.name}"؟ سيتم إزالة هذه الفئة من جميع جهات الاتصال المرتبطة بها.`)) {
            const categoryRef = doc(firestore, `users/${user.uid}/categories/${category.id}`);
            deleteDocumentNonBlocking(categoryRef);
        }
    }

  return (
    <>
        <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>قائمة الفئات</CardTitle>
                    <CardDescription>
                        تنظيم جهات الاتصال الخاصة بك في فئات.
                    </CardDescription>
                </div>
                <Button size="sm" className="gap-2" onClick={handleAddNew}>
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
                {isLoading ? (
                     Array.from({ length: 2 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                        </TableRow>
                    ))
                ) : categories.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={2} className="h-24 text-center">
                            لا توجد فئات لعرضها.
                        </TableCell>
                    </TableRow>
                ) : (
                categories.map((category) => (
                <TableRow key={category.id}>
                    <TableCell>
                    <Badge variant="outline">{category.name}</Badge>
                    </TableCell>
                    <TableCell className="text-left">
                        <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(category)}>
                                        <Edit className="mr-2 h-4 w-4" />
                                        تعديل
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDelete(category)} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        حذف
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                    </TableCell>
                </TableRow>
                )))}
            </TableBody>
            </Table>
        </CardContent>
        </Card>
        <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{editingCategory ? 'تعديل الفئة' : 'إضافة فئة جديدة'}</DialogTitle>
                     <DialogDescription>
                       {editingCategory ? 'قم بتحديث اسم الفئة.' : 'أدخل اسمًا للفئة الجديدة.'}
                    </DialogDescription>
                </DialogHeader>
                <CategoryForm category={editingCategory} onFormSubmit={() => setFormOpen(false)} />
            </DialogContent>
        </Dialog>
    </>
  );
}
