'use client';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Edit, Trash2, Copy, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    shortcut: '',
    content: '',
    category: '',
  });

  // Mock data - replace with Supabase
  const [responses, setResponses] = useState<CannedResponse[]>([
    {
      id: '1',
      title: 'رسالة ترحيب',
      shortcut: '/welcome',
      content: 'مرحباً بك! كيف يمكنني مساعدتك اليوم؟',
      category: 'عام',
      usage_count: 245,
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      title: 'أوقات العمل',
      shortcut: '/hours',
      content: 'أوقات العمل لدينا من الأحد إلى الخميس من 9 صباحاً حتى 6 مساءً.',
      category: 'معلومات',
      usage_count: 189,
      created_at: new Date().toISOString(),
    },
    {
      id: '3',
      title: 'طلب معلومات إضافية',
      shortcut: '/info',
      content: 'لكي أساعدك بشكل أفضل، هل يمكنك تزويدي ببعض التفاصيل الإضافية؟',
      category: 'استفسار',
      usage_count: 156,
      created_at: new Date().toISOString(),
    },
    {
      id: '4',
      title: 'شكر العميل',
      shortcut: '/thanks',
      content: 'شكراً لتواصلك معنا! سعداء بخدمتك.',
      category: 'عام',
      usage_count: 312,
      created_at: new Date().toISOString(),
    },
  ]);

  const filteredResponses = responses.filter(
    (r) =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.shortcut.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const createResponse = () => {
    const newResponse: CannedResponse = {
      id: Date.now().toString(),
      ...formData,
      usage_count: 0,
      created_at: new Date().toISOString(),
    };

    setResponses([newResponse, ...responses]);
    setFormData({ title: '', shortcut: '', content: '', category: '' });
    setIsCreateOpen(false);

    toast({
      title: 'تم الإنشاء',
      description: 'تم إضافة الرد السريع بنجاح',
    });
  };

  const deleteResponse = (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الرد؟')) return;
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

  const categories = Array.from(new Set(responses.map((r) => r.category)));

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
                  <Button variant="ghost" size="sm">
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
