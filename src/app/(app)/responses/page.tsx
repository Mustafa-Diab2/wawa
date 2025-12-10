'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Edit, Trash2, Copy, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface CannedResponse {
  id: string;
  title: string;
  shortcut: string;
  content: string;
  category: string;
  usage_count: number;
  created_at: string;
}

export default function ResponsesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    shortcut: '',
    content: '',
    category: '',
  });
  const [editingResponse, setEditingResponse] = useState<CannedResponse | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);

  // Check auth and load data
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
    loadResponses(user.id);
  };

  const loadResponses = async (uid: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('canned_responses')
      .select('*')
      .eq('user_id', uid)
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (error) {
      console.error('Error loading responses:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل الردود السريعة',
        variant: 'destructive',
      });
    } else {
      setResponses(data || []);
    }
    setIsLoading(false);
  };

  const filteredResponses = responses.filter(
    (r) =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.shortcut.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createResponse = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('canned_responses')
      .insert({
        user_id: userId,
        title: formData.title,
        shortcut: formData.shortcut,
        content: formData.content,
        category: formData.category,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating response:', error);
      toast({
        title: 'خطأ',
        description: error.message.includes('unique')
          ? 'هذا الاختصار موجود بالفعل'
          : 'فشل إنشاء الرد السريع',
        variant: 'destructive',
      });
      return;
    }

    setResponses([data, ...responses]);
    setFormData({ title: '', shortcut: '', content: '', category: '' });
    setIsCreateOpen(false);

    toast({
      title: 'تم الإنشاء',
      description: 'تم إضافة الرد السريع بنجاح',
    });
  };

  const deleteResponse = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الرد؟')) return;

    const { error } = await supabase
      .from('canned_responses')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error deleting response:', error);
      toast({
        title: 'خطأ',
        description: 'فشل حذف الرد السريع',
        variant: 'destructive',
      });
      return;
    }

    setResponses(responses.filter((r) => r.id !== id));
    toast({
      title: 'تم الحذف',
      description: 'تم حذف الرد السريع',
    });
  };

  const copyResponse = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'تم النسخ',
      description: 'تم نسخ الرد إلى الحافظة',
    });
  };

  const editResponse = (response: CannedResponse) => {
    console.log('Editing response:', response);
    setEditingResponse(response);
    setFormData({
      title: response.title,
      shortcut: response.shortcut,
      content: response.content,
      category: response.category,
    });
    setIsEditOpen(true);
    console.log('Edit dialog should open now');
  };

  const updateResponse = async () => {
    if (!editingResponse) return;

    const { error } = await supabase
      .from('canned_responses')
      .update({
        title: formData.title,
        shortcut: formData.shortcut,
        content: formData.content,
        category: formData.category,
      })
      .eq('id', editingResponse.id);

    if (error) {
      console.error('Error updating response:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحديث الرد السريع',
        variant: 'destructive',
      });
      return;
    }

    setResponses(responses.map(r =>
      r.id === editingResponse.id ? { ...r, ...formData } : r
    ));
    setFormData({ title: '', shortcut: '', content: '', category: '' });
    setIsEditOpen(false);
    setEditingResponse(null);

    toast({
      title: 'تم التحديث',
      description: 'تم تحديث الرد السريع بنجاح',
    });
  };

  const categories = Array.from(new Set(responses.map((r) => r.category)));

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
          <h1 className="text-3xl font-bold">الردود السريعة</h1>
          <p className="text-muted-foreground">إدارة الردود الجاهزة والاختصارات</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="ml-2 h-4 w-4" />
              إضافة رد جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>إضافة رد سريع جديد</DialogTitle>
              <DialogDescription>
                أنشئ رد جاهز لاستخدامه في المحادثات
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">العنوان</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="مثال: رسالة ترحيب"
                />
              </div>
              <div>
                <Label htmlFor="shortcut">الاختصار</Label>
                <Input
                  id="shortcut"
                  value={formData.shortcut}
                  onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                  placeholder="مثال: /welcome"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  استخدم هذا الاختصار في المحادثات لإدراج الرد
                </p>
              </div>
              <div>
                <Label htmlFor="category">الفئة</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="مثال: عام، استفسار، شكوى"
                />
              </div>
              <div>
                <Label htmlFor="content">المحتوى</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="اكتب نص الرد هنا..."
                  rows={6}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                إلغاء
              </Button>
              <Button
                onClick={createResponse}
                disabled={!formData.title || !formData.content || !formData.shortcut}
              >
                إنشاء
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-3">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث في الردود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الردود</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{responses.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Categories */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Badge key={category} variant="outline" className="cursor-pointer">
            {category} ({responses.filter((r) => r.category === category).length})
          </Badge>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تعديل الرد السريع</DialogTitle>
            <DialogDescription>
              عدّل بيانات الرد السريع
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">العنوان</Label>
              <Input
                id="edit-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="مثال: رسالة ترحيب"
              />
            </div>
            <div>
              <Label htmlFor="edit-shortcut">الاختصار</Label>
              <Input
                id="edit-shortcut"
                value={formData.shortcut}
                onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                placeholder="مثال: /welcome"
              />
            </div>
            <div>
              <Label htmlFor="edit-category">الفئة</Label>
              <Input
                id="edit-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="مثال: عام، استفسار، شكوى"
              />
            </div>
            <div>
              <Label htmlFor="edit-content">المحتوى</Label>
              <Textarea
                id="edit-content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="اكتب نص الرد هنا..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditOpen(false);
              setEditingResponse(null);
              setFormData({ title: '', shortcut: '', content: '', category: '' });
            }}>
              إلغاء
            </Button>
            <Button
              onClick={updateResponse}
              disabled={!formData.title || !formData.content || !formData.shortcut}
            >
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Responses List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredResponses.map((response) => (
          <Card key={response.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base">{response.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {response.shortcut}
                    </code>
                    <Badge variant="secondary" className="text-xs">
                      {response.category}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {response.content}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>استخدم {response.usage_count} مرة</span>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyResponse(response.content)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => editResponse(response)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteResponse(response.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredResponses.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <MessageSquare className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">لا توجد ردود تطابق البحث</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
