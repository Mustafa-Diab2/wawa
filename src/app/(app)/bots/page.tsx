'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Bot, BotKnowledge } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, Bot as BotIcon, Trash2, Edit, Brain } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export default function BotsPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isKnowledgeDialogOpen, setIsKnowledgeDialogOpen] = useState(false);
  const [knowledge, setKnowledge] = useState<BotKnowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    personality: 'أنت مساعد ذكي ومفيد. تجيب على أسئلة العملاء بشكل ودود ومحترف.',
    temperature: 0.7,
    max_tokens: 1000,
  });

  const [knowledgeForm, setKnowledgeForm] = useState({
    title: '',
    content: '',
    category: '',
    keywords: '',
  });

  useEffect(() => {
    fetchBots();
  }, []);

  const fetchBots = async () => {
    try {
      const { data, error } = await supabase
        .from('bots')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBots(data || []);
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل تحميل البوتات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchKnowledge = async (botId: string) => {
    try {
      const { data, error } = await supabase
        .from('bot_knowledge')
        .select('*')
        .eq('bot_id', botId)
        .order('priority', { ascending: false });

      if (error) throw error;
      setKnowledge(data || []);
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل تحميل المعرفة',
        variant: 'destructive',
      });
    }
  };

  const createBot = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('bots')
        .insert({
          ...formData,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'نجح',
        description: 'تم إنشاء البوت بنجاح',
      });

      setBots([data, ...bots]);
      setIsCreateDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل إنشاء البوت',
        variant: 'destructive',
      });
    }
  };

  const deleteBot = async (botId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا البوت؟')) return;

    try {
      const { error } = await supabase
        .from('bots')
        .delete()
        .eq('id', botId);

      if (error) throw error;

      toast({
        title: 'نجح',
        description: 'تم حذف البوت',
      });

      setBots(bots.filter(b => b.id !== botId));
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل حذف البوت',
        variant: 'destructive',
      });
    }
  };

  const addKnowledge = async () => {
    if (!selectedBot) return;

    try {
      const { data, error } = await supabase
        .from('bot_knowledge')
        .insert({
          bot_id: selectedBot.id,
          ...knowledgeForm,
          keywords: knowledgeForm.keywords.split(',').map(k => k.trim()).filter(k => k),
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'نجح',
        description: 'تمت إضافة المعرفة',
      });

      setKnowledge([data, ...knowledge]);
      setKnowledgeForm({ title: '', content: '', category: '', keywords: '' });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشلت إضافة المعرفة',
        variant: 'destructive',
      });
    }
  };

  const deleteKnowledge = async (id: string) => {
    try {
      const { error } = await supabase
        .from('bot_knowledge')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setKnowledge(knowledge.filter(k => k.id !== id));
      toast({
        title: 'نجح',
        description: 'تم حذف المعرفة',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل حذف المعرفة',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      personality: 'أنت مساعد ذكي ومفيد. تجيب على أسئلة العملاء بشكل ودود ومحترف.',
      temperature: 0.7,
      max_tokens: 1000,
    });
  };

  const openKnowledgeDialog = (bot: Bot) => {
    setSelectedBot(bot);
    fetchKnowledge(bot.id);
    setIsKnowledgeDialogOpen(true);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full">جاري التحميل...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">البوتات الذكية</h1>
          <p className="text-muted-foreground">إدارة البوتات وإضافة المعرفة لهم</p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="ml-2 h-4 w-4" />
              إضافة بوت جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>إنشاء بوت جديد</DialogTitle>
              <DialogDescription>
                أضف بوت ذكي مع شخصية مخصصة للرد على العملاء
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">اسم البوت</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: بوت خدمة العملاء"
                />
              </div>

              <div>
                <Label htmlFor="description">الوصف</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف مختصر للبوت"
                />
              </div>

              <div>
                <Label htmlFor="personality">شخصية البوت (Instructions)</Label>
                <Textarea
                  id="personality"
                  value={formData.personality}
                  onChange={(e) => setFormData({ ...formData, personality: e.target.value })}
                  rows={6}
                  placeholder="اكتب تعليمات لكيفية تصرف البوت..."
                  className="font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="temperature">Temperature (الإبداعية)</Label>
                  <Input
                    id="temperature"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="max_tokens">Max Tokens</Label>
                  <Input
                    id="max_tokens"
                    type="number"
                    value={formData.max_tokens}
                    onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={createBot} disabled={!formData.name}>
                إنشاء البوت
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {bots.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BotIcon className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg text-muted-foreground">لا توجد بوتات بعد</p>
            <p className="text-sm text-muted-foreground mb-4">ابدأ بإنشاء بوت ذكي</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.map((bot) => (
            <Card key={bot.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <BotIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{bot.name}</CardTitle>
                      <Badge variant={bot.is_active ? 'default' : 'secondary'} className="mt-1">
                        {bot.is_active ? 'نشط' : 'غير نشط'}
                      </Badge>
                    </div>
                  </div>
                </div>
                {bot.description && (
                  <CardDescription className="mt-2">{bot.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Temperature:</span>
                    <span>{bot.temperature}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Tokens:</span>
                    <span>{bot.max_tokens}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openKnowledgeDialog(bot)}
                  >
                    <Brain className="ml-2 h-4 w-4" />
                    المعرفة
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteBot(bot.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Knowledge Dialog */}
      <Dialog open={isKnowledgeDialogOpen} onOpenChange={setIsKnowledgeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>قاعدة معرفة: {selectedBot?.name}</DialogTitle>
            <DialogDescription>
              أضف معلومات ليتذكرها البوت ويستخدمها في الردود
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">إضافة معرفة جديدة</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>العنوان</Label>
                  <Input
                    value={knowledgeForm.title}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                    placeholder="عنوان المعلومة"
                  />
                </div>
                <div>
                  <Label>المحتوى</Label>
                  <Textarea
                    value={knowledgeForm.content}
                    onChange={(e) => setKnowledgeForm({ ...knowledgeForm, content: e.target.value })}
                    placeholder="اكتب المعلومة التي تريد أن يتذكرها البوت..."
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>الفئة</Label>
                    <Input
                      value={knowledgeForm.category}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, category: e.target.value })}
                      placeholder="مثال: منتجات، أسعار"
                    />
                  </div>
                  <div>
                    <Label>الكلمات المفتاحية (مفصولة بفاصلة)</Label>
                    <Input
                      value={knowledgeForm.keywords}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, keywords: e.target.value })}
                      placeholder="سعر، منتج، شحن"
                    />
                  </div>
                </div>
                <Button onClick={addKnowledge} disabled={!knowledgeForm.title || !knowledgeForm.content}>
                  <PlusCircle className="ml-2 h-4 w-4" />
                  إضافة
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="font-semibold">المعارف المحفوظة ({knowledge.length})</h3>
              {knowledge.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  لا توجد معارف بعد. أضف معلومات ليتعلمها البوت.
                </p>
              ) : (
                knowledge.map((k) => (
                  <Card key={k.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-sm">{k.title}</CardTitle>
                          {k.category && (
                            <Badge variant="outline" className="mt-1">{k.category}</Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteKnowledge(k.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {k.content}
                      {k.keywords.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {k.keywords.map((keyword, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
