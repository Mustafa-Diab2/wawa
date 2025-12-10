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
import { Users, UserPlus, Shield, Activity, Clock, MessageSquare, UserMinus } from 'lucide-react';
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
  const [userId, setUserId] = useState<string>('');
  const { toast } = useToast();

  const [inviteForm, setInviteForm] = useState({
    email: '',
    password: '',
    fullName: '',
    role: 'agent' as 'admin' | 'agent',
  });

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      // Get current user to verify authentication
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      setUserId(currentUser.id);

      // Get session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Fetch all users from API
      const response = await fetch('/api/team/list-users', { headers });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل تحميل الأعضاء');
      }

      // Get total chats count
      const { count: totalChats } = await supabase
        .from('chats')
        .select('*', { count: 'only', head: true });

      // Get today's message count
      const { count: todayMessages } = await supabase
        .from('messages')
        .select('*', { count: 'only', head: true })
        .eq('is_from_us', true)
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());

      // Transform users to team members
      const teamMembers: TeamMember[] = result.users.map((user: any) => ({
        id: user.id,
        email: user.email || '',
        role: user.user_metadata?.role || 'agent',
        status: user.id === currentUser.id ? 'online' : 'offline',
        created_at: user.created_at,
        stats: {
          total_chats: user.id === currentUser.id ? (totalChats || 0) : 0,
          avg_response_time: 0,
          messages_today: user.id === currentUser.id ? (todayMessages || 0) : 0,
        },
      }));

      setMembers(teamMembers);
    } catch (error: any) {
      console.error('Error fetching team:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل تحميل بيانات الفريق',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const inviteTeamMember = async () => {
    try {
      if (!inviteForm.email || !inviteForm.password || !inviteForm.fullName) {
        toast({
          title: 'خطأ',
          description: 'يرجى ملء جميع الحقول',
          variant: 'destructive',
        });
        return;
      }

      if (inviteForm.password.length < 6) {
        toast({
          title: 'خطأ',
          description: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
          variant: 'destructive',
        });
        return;
      }

      // Get session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      // Call API to create new user
      const response = await fetch('/api/team/create-user', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: inviteForm.email,
          password: inviteForm.password,
          fullName: inviteForm.fullName,
          role: inviteForm.role,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل إضافة المستخدم');
      }

      toast({
        title: 'تم إضافة المستخدم بنجاح',
        description: result.message,
      });

      setIsInviteOpen(false);
      setInviteForm({ email: '', password: '', fullName: '', role: 'agent' });
      fetchTeamMembers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'فشل إضافة المستخدم',
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
              <DialogTitle>إضافة عضو جديد</DialogTitle>
              <DialogDescription>
                إنشاء حساب جديد لعضو في الفريق
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={inviteForm.fullName}
                  onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                  placeholder="محمد أحمد"
                />
              </div>
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
                <Label htmlFor="password">كلمة المرور</Label>
                <Input
                  id="password"
                  type="password"
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="••••••••"
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground mt-1">6 أحرف على الأقل</p>
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
              <Button onClick={inviteTeamMember}>إضافة المستخدم</Button>
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
              {/* Action Buttons - Only show for other members */}
              {member.id !== userId && (
                <div className="flex gap-2 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      // TODO: Implement change role functionality
                      toast({
                        title: 'قريباً',
                        description: 'ميزة تغيير الدور قريباً',
                      });
                    }}
                  >
                    <Shield className="ml-1 h-3 w-3" />
                    تغيير الدور
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      if (!confirm(`هل أنت متأكد من حذف ${member.email?.split('@')[0]}؟`)) return;

                      try {
                        // Get session for auth token
                        const { data: { session } } = await supabase.auth.getSession();
                        const headers: HeadersInit = {
                          'Content-Type': 'application/json',
                        };

                        if (session?.access_token) {
                          headers['Authorization'] = `Bearer ${session.access_token}`;
                        }

                        const response = await fetch('/api/team/delete-user', {
                          method: 'POST',
                          headers,
                          body: JSON.stringify({ userId: member.id }),
                        });

                        if (!response.ok) {
                          throw new Error('فشل حذف العضو');
                        }

                        setMembers(members.filter(m => m.id !== member.id));
                        toast({
                          title: 'تم الحذف',
                          description: 'تم حذف العضو من الفريق',
                        });
                      } catch (error: any) {
                        toast({
                          title: 'خطأ',
                          description: error.message || 'فشل حذف العضو',
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    <UserMinus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
