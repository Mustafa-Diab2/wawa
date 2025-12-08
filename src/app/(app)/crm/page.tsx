'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Phone, Mail, Calendar, MessageSquare, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Customer {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  notes?: string;
  tags: string[];
  last_contact?: string;
  total_messages: number;
  created_at: string;
}

export default function CRMPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUserId(user.id);
    loadCustomers();
  };

  const loadCustomers = async () => {
    setIsLoading(true);
    try {
      // Load all chats as customers
      const { data: chats, error } = await supabase
        .from('chats')
        .select(`
          id,
          name,
          phone_number,
          created_at,
          updated_at
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Get message count for each chat
      const customersWithStats = await Promise.all(
        (chats || []).map(async (chat) => {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'only', head: true })
            .eq('chat_id', chat.id);

          return {
            id: chat.id,
            phone: chat.phone_number || '',
            name: chat.name || undefined,
            email: undefined,
            notes: undefined,
            tags: [],
            last_contact: chat.updated_at,
            total_messages: count || 0,
            created_at: chat.created_at,
          };
        })
      );

      setCustomers(customersWithStats);
    } catch (error: any) {
      console.error('Error loading customers:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل بيانات العملاء',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCustomers = customers.filter((c) =>
    c.phone.includes(searchQuery) ||
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openDetails = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailsOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">إدارة العملاء (CRM)</h1>
          <p className="text-muted-foreground">إدارة قاعدة بيانات العملاء والتواصل معهم</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي العملاء</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عملاء جدد (هذا الشهر)</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customers.filter((c) => {
                const date = new Date(c.created_at);
                const now = new Date();
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
              }).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نشطين اليوم</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customers.filter((c) => {
                if (!c.last_contact) return false;
                const date = new Date(c.last_contact);
                const now = new Date();
                return date.toDateString() === now.toDateString();
              }).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي المحادثات</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customers.reduce((sum, c) => sum + c.total_messages, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن عميل (رقم الهاتف، الاسم، البريد)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Customers List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredCustomers.map((customer) => (
          <Card key={customer.id} className="cursor-pointer hover:border-primary" onClick={() => openDetails(customer)}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{customer.name || 'عميل'}</CardTitle>
                    {customer.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      <span>{customer.phone}</span>
                    </div>
                    {customer.email && (
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span>{customer.email}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      <span>{customer.total_messages} رسالة</span>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {customer.last_contact && `آخر تواصل: ${new Date(customer.last_contact).toLocaleDateString('ar-SA')}`}
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {filteredCustomers.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Users className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-lg text-muted-foreground">لا يوجد عملاء</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Customer Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل العميل</DialogTitle>
            <DialogDescription>معلومات شاملة عن العميل</DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <Tabs defaultValue="info" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="info">المعلومات</TabsTrigger>
                <TabsTrigger value="notes">الملاحظات</TabsTrigger>
                <TabsTrigger value="history">السجل</TabsTrigger>
              </TabsList>

              <TabsContent value="info" className="space-y-4">
                <div>
                  <Label>الاسم</Label>
                  <p className="text-sm">{selectedCustomer.name || 'غير محدد'}</p>
                </div>
                <div>
                  <Label>رقم الهاتف</Label>
                  <p className="text-sm">{selectedCustomer.phone}</p>
                </div>
                <div>
                  <Label>البريد الإلكتروني</Label>
                  <p className="text-sm">{selectedCustomer.email || 'غير محدد'}</p>
                </div>
                <div>
                  <Label>إجمالي الرسائل</Label>
                  <p className="text-sm">{selectedCustomer.total_messages} رسالة</p>
                </div>
                <div>
                  <Label>تاريخ الإضافة</Label>
                  <p className="text-sm">{new Date(selectedCustomer.created_at).toLocaleDateString('ar-SA')}</p>
                </div>
                {selectedCustomer.last_contact && (
                  <div>
                    <Label>آخر تواصل</Label>
                    <p className="text-sm">{new Date(selectedCustomer.last_contact).toLocaleString('ar-SA')}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
                <div>
                  <Label htmlFor="notes">ملاحظات</Label>
                  <Textarea
                    id="notes"
                    value={selectedCustomer.notes || ''}
                    rows={6}
                    placeholder="أضف ملاحظات عن العميل..."
                    disabled
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    هذه الميزة قيد التطوير - قريباً ستتمكن من تعديل وحفظ الملاحظات
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  سجل التفاعلات والمحادثات قيد التطوير - قريباً!
                </p>
              </TabsContent>
            </Tabs>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
