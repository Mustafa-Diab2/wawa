'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, UserPlus, Shield, Activity, Clock, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TeamMember {
  id: string;
  email: string;
  role: 'admin' | 'agent';
  status: 'online' | 'offline' | 'away';
  created_at: string;
  last_seen?: string;
  stats?: {
    total_chats: number;
    avg_response_time: number;
    messages_today: number;
  };
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const { toast } = useToast();

  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'agent' as 'admin' | 'agent',
  });

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all users (this would normally be in a team/organization structure)
      // For now, we'll just show the current user
      const today = new Date().toISOString().split('T')[0];

      // Get stats for current user
      const { data: statsData } = await supabase
        .from('agent_stats')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      // Get today's message count
      const { count: todayMessages } = await supabase
        .from('messages')
        .select('*', { count: 'only', head: true })
        .eq('from_me', true)
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

      const member: TeamMember = {
        id: user.id,
        email: user.email || '',
        role: 'admin',
        status: 'online',
        created_at: user.created_at,
        stats: {
          total_chats: statsData?.total_chats || 0,
          avg_response_time: statsData?.avg_response_time || 0,
          messages_today: todayMessages || 0,
        },
      };

      setMembers([member]);
    } catch (error) {
      console.error('Error fetching team:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل بيانات الفريق',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const inviteTeamMember = async () => {
    try {
      // TODO: Implement actual invite logic with Supabase
      toast({
        title: 'تم إرسال الدعوة',
        description: `تم إرسال دعوة إلى ${inviteForm.email}`,
      });
      setIsInviteOpen(false);
      setInviteForm({ email: '', role: 'agent' });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: 'فشل إرسال الدعوة',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      online: 'default',
      offline: 'secondary',
      away: 'outline',
    };
    const labels: Record<string, string> = {
      online: 'متصل',
      offline: 'غير متصل',
      away: 'بعيد',
    };
    return (
      <Badge variant={variants[status]}>
        {labels[status]}
      </Badge>
    );
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full">جاري التحميل...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">إدارة الفريق</h1>
          <p className="text-muted-foreground">إدارة أعضاء فريق العمل ومراقبة نشاطهم</p>
        </div>
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="ml-2 h-4 w-4" />
              دعوة عضو جديد
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>دعوة عضو جديد</DialogTitle>
              <DialogDescription>
                أرسل دعوة لإضافة عضو جديد للفريق
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <Label htmlFor="role">الدور</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(value: 'admin' | 'agent') => setInviteForm({ ...inviteForm, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">موظف</SelectItem>
                    <SelectItem value="admin">مدير</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={inviteTeamMember}>إرسال الدعوة</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الأعضاء</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متصل الآن</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {members.filter((m) => m.status === 'online').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متوسط وقت الرد</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.5 دقيقة</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">رسائل اليوم</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {members.reduce((sum, m) => sum + (m.stats?.messages_today || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Members List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map((member) => (
          <Card key={member.id}>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.email || 'user'}`} />
                  <AvatarFallback>{member.email?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{member.email?.split('@')[0] || 'مستخدم'}</CardTitle>
                    {member.role === 'admin' && (
                      <Shield className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <CardDescription className="text-sm">{member.email || 'لا يوجد بريد إلكتروني'}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الحالة</span>
                {getStatusBadge(member.status)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الدور</span>
                <Badge variant="outline">
                  {member.role === 'admin' ? 'مدير' : 'موظف'}
                </Badge>
              </div>
              {member.stats && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">المحادثات</span>
                    <span className="text-sm font-medium">{member.stats.total_chats}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">وقت الرد</span>
                    <span className="text-sm font-medium">{member.stats.avg_response_time}ث</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">رسائل اليوم</span>
                    <span className="text-sm font-medium">{member.stats.messages_today}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
