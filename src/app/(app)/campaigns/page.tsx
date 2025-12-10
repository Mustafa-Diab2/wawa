'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Plus, Eye, Users, CheckCircle, XCircle, Clock, Edit, Trash2, Pause, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed';
  target_audience: string;
  recipients_count: number;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  scheduled_at?: string;
  created_at: string;
}

export default function CampaignsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    target_audience: 'all',
    schedule_type: 'now',
    scheduled_at: '',
  });
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
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
    loadCampaigns(user.id);
  };

  const loadCampaigns = async (uid: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading campaigns:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل الحملات',
        variant: 'destructive',
      });
    } else {
      setCampaigns(data || []);
    }
    setIsLoading(false);
  };

  const getStatusBadge = (status: Campaign['status']) => {
    const variants: Record<Campaign['status'], any> = {
      draft: 'secondary',
      scheduled: 'outline',
      sending: 'default',
      completed: 'default',
      failed: 'destructive',
    };
    const labels: Record<Campaign['status'], string> = {
      draft: 'مسودة',
      scheduled: 'مجدولة',
      sending: 'جاري الإرسال',
      completed: 'مكتملة',
      failed: 'فشلت',
    };
    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  const createCampaign = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        user_id: userId,
        name: formData.name,
        message: formData.message,
        status: formData.schedule_type === 'now' ? 'sending' : 'scheduled',
        target_audience: formData.target_audience,
        scheduled_at: formData.schedule_type === 'scheduled' ? formData.scheduled_at : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: 'خطأ',
        description: 'فشل إنشاء الحملة',
        variant: 'destructive',
      });
      return;
    }

    setCampaigns([data, ...campaigns]);
    setFormData({ name: '', message: '', target_audience: 'all', schedule_type: 'now', scheduled_at: '' });
    setIsCreateOpen(false);

    toast({
      title: 'تم الإنشاء',
      description: formData.schedule_type === 'now' ? 'جاري إرسال الحملة...' : 'تم جدولة الحملة بنجاح',
    });
  };

  const getSuccessRate = (campaign: Campaign) => {
    if (campaign.sent_count === 0) return 0;
    return Math.round((campaign.delivered_count / campaign.sent_count) * 100);
  };

  const editCampaign = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setFormData({
      name: campaign.name,
      message: campaign.message,
      target_audience: campaign.target_audience,
      schedule_type: campaign.scheduled_at ? 'scheduled' : 'now',
      scheduled_at: campaign.scheduled_at || '',
    });
    setIsEditOpen(true);
  };

  const updateCampaign = async () => {
    if (!editingCampaign) return;

    const { error } = await supabase
      .from('campaigns')
      .update({
        name: formData.name,
        message: formData.message,
        target_audience: formData.target_audience,
        scheduled_at: formData.schedule_type === 'scheduled' ? formData.scheduled_at : null,
      })
      .eq('id', editingCampaign.id);

    if (error) {
      console.error('Error updating campaign:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحديث الحملة',
        variant: 'destructive',
      });
      return;
    }

    setCampaigns(campaigns.map(c =>
      c.id === editingCampaign.id ? { ...c, ...formData } : c
    ));
    setFormData({ name: '', message: '', target_audience: 'all', schedule_type: 'now', scheduled_at: '' });
    setIsEditOpen(false);
    setEditingCampaign(null);

    toast({
      title: 'تم التحديث',
      description: 'تم تحديث الحملة بنجاح',
    });
  };

  const togglePauseCampaign = async (campaign: Campaign) => {
    const newStatus = campaign.status === 'sending' ? 'draft' : 'sending';

    const { error } = await supabase
      .from('campaigns')
      .update({ status: newStatus })
      .eq('id', campaign.id);

    if (error) {
      console.error('Error toggling campaign:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تغيير حالة الحملة',
        variant: 'destructive',
      });
      return;
    }

    setCampaigns(campaigns.map(c =>
      c.id === campaign.id ? { ...c, status: newStatus } : c
    ));

    toast({
      title: newStatus === 'sending' ? 'تم التشغيل' : 'تم الإيقاف',
      description: newStatus === 'sending' ? 'تم تشغيل الحملة' : 'تم إيقاف الحملة مؤقتاً',
    });
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الحملة؟')) return;

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: 'خطأ',
        description: 'فشل حذف الحملة',
        variant: 'destructive',
      });
      return;
    }

    setCampaigns(campaigns.filter(c => c.id !== id));
    toast({
      title: 'تم الحذف',
      description: 'تم حذف الحملة بنجاح',
    });
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
          <h1 className="text-3xl font-bold">الحملات الإعلانية</h1>
          <p className="text-muted-foreground">إرسال رسائل جماعية للعملاء</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="ml-2 h-4 w-4" />
              إنشاء حملة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>إنشاء حملة جديدة</DialogTitle>
              <DialogDescription>
                أرسل رسالة جماعية لعملائك
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">اسم الحملة</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: عرض الصيف"
                />
              </div>
              <div>
                <Label htmlFor="target">الجمهور المستهدف</Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(value) => setFormData({ ...formData, target_audience: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع العملاء</SelectItem>
                    <SelectItem value="vip">عملاء VIP</SelectItem>
                    <SelectItem value="new">عملاء جدد</SelectItem>
                    <SelectItem value="inactive">عملاء غير نشطين</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="message">نص الرسالة</Label>
                <Textarea
                  id="message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="اكتب رسالتك هنا..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.message.length} / 1000 حرف
                </p>
              </div>
              <div>
                <Label htmlFor="schedule">وقت الإرسال</Label>
                <Select
                  value={formData.schedule_type}
                  onValueChange={(value) => setFormData({ ...formData, schedule_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="now">إرسال الآن</SelectItem>
                    <SelectItem value="scheduled">جدولة للإرسال</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.schedule_type === 'scheduled' && (
                <div>
                  <Label htmlFor="scheduled_at">تاريخ ووقت الإرسال</Label>
                  <Input
                    id="scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                إلغاء
              </Button>
              <Button
                onClick={createCampaign}
                disabled={!formData.name || !formData.message}
              >
                <Send className="ml-2 h-4 w-4" />
                {formData.schedule_type === 'now' ? 'إرسال الآن' : 'جدولة'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>تعديل الحملة</DialogTitle>
              <DialogDescription>
                عدّل بيانات الحملة
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">اسم الحملة</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: عرض الصيف"
                />
              </div>
              <div>
                <Label htmlFor="edit-target">الجمهور المستهدف</Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(value) => setFormData({ ...formData, target_audience: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع العملاء</SelectItem>
                    <SelectItem value="vip">عملاء VIP</SelectItem>
                    <SelectItem value="new">عملاء جدد</SelectItem>
                    <SelectItem value="inactive">عملاء غير نشطين</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-message">نص الرسالة</Label>
                <Textarea
                  id="edit-message"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="اكتب رسالتك هنا..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.message.length} / 1000 حرف
                </p>
              </div>
              <div>
                <Label htmlFor="edit-schedule">وقت الإرسال</Label>
                <Select
                  value={formData.schedule_type}
                  onValueChange={(value) => setFormData({ ...formData, schedule_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="now">إرسال الآن</SelectItem>
                    <SelectItem value="scheduled">جدولة للإرسال</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.schedule_type === 'scheduled' && (
                <div>
                  <Label htmlFor="edit-scheduled_at">تاريخ ووقت الإرسال</Label>
                  <Input
                    id="edit-scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsEditOpen(false);
                setEditingCampaign(null);
                setFormData({ name: '', message: '', target_audience: 'all', schedule_type: 'now', scheduled_at: '' });
              }}>
                إلغاء
              </Button>
              <Button
                onClick={updateCampaign}
                disabled={!formData.name || !formData.message}
              >
                حفظ التعديلات
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الحملات</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{campaigns.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">رسائل مرسلة</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.reduce((sum, c) => sum + c.sent_count, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تم التوصيل</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.reduce((sum, c) => sum + c.delivered_count, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">فشل الإرسال</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {campaigns.reduce((sum, c) => sum + c.failed_count, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {campaigns.map((campaign) => (
          <Card key={campaign.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    {getStatusBadge(campaign.status)}
                  </div>
                  <CardDescription>{campaign.target_audience}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => editCampaign(campaign)}
                    title="تعديل"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  {(campaign.status === 'sending' || campaign.status === 'draft') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => togglePauseCampaign(campaign)}
                      title={campaign.status === 'sending' ? 'إيقاف' : 'تشغيل'}
                    >
                      {campaign.status === 'sending' ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => deleteCampaign(campaign.id)}
                    title="حذف"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{campaign.message}</p>

              {campaign.status !== 'draft' && (
                <>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{campaign.recipients_count} مستلم</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-muted-foreground" />
                      <span>{campaign.sent_count} مرسل</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>{campaign.delivered_count} تم التوصيل</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>{campaign.failed_count} فشل</span>
                    </div>
                  </div>

                  {campaign.sent_count > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>معدل النجاح</span>
                        <span className="font-medium">{getSuccessRate(campaign)}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${getSuccessRate(campaign)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {campaign.scheduled_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>مجدولة في: {campaign.scheduled_at}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
