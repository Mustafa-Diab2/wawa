'use client';
import { useState } from 'react';
import { PlusCircle, Search, FileDown, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Contact, Category } from '@/lib/types';
import { useFirestore, useUser, deleteDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Skeleton } from '../ui/skeleton';
import ContactForm from './contact-form';


interface ContactsTableProps {
    contacts: Contact[];
    categories: Category[];
    isLoading: boolean;
}

export default function ContactsTable({ contacts, categories, isLoading }: ContactsTableProps) {
    const { user } = useUser();
    const firestore = useFirestore();
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<Contact | null>(null);

    const getCategoryName = (id: string | null) => {
        return categories.find(c => c.id === id)?.name || '-';
    }

    const handleEdit = (contact: Contact) => {
        setEditingContact(contact);
        setFormOpen(true);
    }
    
    const handleAddNew = () => {
        setEditingContact(null);
        setFormOpen(true);
    }

    const handleDelete = (contact: Contact) => {
        if (!user || !firestore || !contact.id) return;
        if(window.confirm(`هل أنت متأكد أنك تريد حذف جهة الاتصال "${contact.name}"?`)) {
            const contactRef = doc(firestore, `users/${user.uid}/contacts/${contact.id}`);
            deleteDocumentNonBlocking(contactRef);
        }
    }

  return (
      <>
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
                     <Button size="sm" className="gap-2" onClick={handleAddNew}>
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
                <TableHead className="text-left">الإجراءات</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                        </TableRow>
                    ))
                ) : contacts.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            لا توجد جهات اتصال لعرضها.
                        </TableCell>
                    </TableRow>
                ) : (
                contacts.map((contact) => (
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
                    <TableCell>{contact.email || '-'}</TableCell>
                    <TableCell>
                        {contact.categoryId && <Badge variant="secondary">{getCategoryName(contact.categoryId)}</Badge>}
                    </TableCell>
                    <TableCell className="text-left">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(contact)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    تعديل
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(contact)} className="text-destructive">
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
                    <DialogTitle>{editingContact ? 'تعديل جهة الاتصال' : 'إضافة جهة اتصال جديدة'}</DialogTitle>
                    <DialogDescription>
                       {editingContact ? 'قم بتحديث تفاصيل جهة الاتصال.' : 'أدخل تفاصيل جهة الاتصال الجديدة.'}
                    </DialogDescription>
                </DialogHeader>
                <ContactForm contact={editingContact} categories={categories} onFormSubmit={() => setFormOpen(false)} />
            </DialogContent>
        </Dialog>
     </>
  );
}
