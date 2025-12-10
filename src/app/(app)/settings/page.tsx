'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';
import { User, Lock, Bell, Users, Settings2, Trash2, UserMinus } from 'lucide-react';

interface UserProfile {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    role?: string;
  };
}

interface TeamMember {
  id: string;
  email: string;
  user_metadata: {
    full_name?: string;
    role?: string;
  };
}

export default function SettingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    fullName: '',
    email: '',
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Status
  const [userStatus, setUserStatus] = useState<'online' | 'away' | 'busy' | 'offline'>('online');

  // Notifications
  const [notifications, setNotifications] = useState({
    email: true,
    desktop: false,
    sound: true,
  });

  // Chat distribution settings
  const [chatDistribution, setChatDistribution] = useState<'round_robin' | 'least_active' | 'manual'>('round_robin');
  const [autoAssign, setAutoAssign] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.push('/login');
        return;
      }

      setUser(currentUser as UserProfile);
      setProfileForm({
        fullName: currentUser.user_metadata?.full_name || '',
        email: currentUser.email || '',
      });

      const role = currentUser.user_metadata?.role || 'agent';
      setIsAdmin(role === 'admin');

      // Load team members if admin
      if (role === 'admin') {
        await loadTeamMembers();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamMembers = async () => {
    try {
      // In a real implementation, you'd fetch from a team_members table
      // For now, we'll just show placeholder
      setTeamMembers([]);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const updateProfile = async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profileForm.fullName,
        }
      });

      if (error) throw error;

      toast({
        title: 'تم التحديث',
        description: 'تم تحديث الملف الشخصي بنجاح',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل تحديث الملف الشخصي',
        variant: 'destructive',
      });
    }
  };

  const updatePassword = async () => {
    try {
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        toast({
          title: 'خطأ',
          description: 'كلمة المرور الجديدة غير متطابقة',
          variant: 'destructive',
        });
        return;
      }

      if (passwordForm.newPassword.length < 6) {
        toast({
          title: 'خطأ',
          description: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
          variant: 'destructive',
        });
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      toast({
        title: 'تم التحديث',
        description: 'تم تحديث كلمة المرور بنجاح',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل تحديث كلمة المرور',
        variant: 'destructive',
      });
    }
  };

  const updateStatus = async (status: typeof userStatus) => {
    setUserStatus(status);
    toast({
      title: 'تم التحديث',
      description: `تم تغيير الحالة إلى ${status === 'online' ? 'متصل' : status === 'away' ? 'بعيد' : status === 'busy' ? 'مشغول' : 'غير متصل'}`,
    });
  };

  const removeTeamMember = async (memberId: string) => {
    if (!confirm('هل أنت متأكد من إزالة هذا العضو من الفريق؟')) return;

    try {
      // Call API to remove team member
      const response = await fetch('/api/team/remove-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: memberId }),
      });

      if (!response.ok) throw new Error('فشل إزالة العضو');

      setTeamMembers(teamMembers.filter(m => m.id !== memberId));
      toast({
        title: 'تم الإزالة',
        description: 'تم إزالة العضو من الفريق',
      });
    } catch (error: any) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل إزالة العضو',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">الإعدادات</h1>
        <p className="text-muted-foreground">إدارة إعدادات حسابك وتفضيلاتك</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>الملف الشخصي</CardTitle>
            </div>
            <CardDescription>تحديث معلومات ملفك الشخصي</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">الاسم</Label>
              <Input
                id="fullName"
                value={profileForm.fullName}
                onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
                placeholder="أحمد محمد"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={profileForm.email}
                readOnly
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">لا يمكن تغيير البريد الإلكتروني</p>
            </div>
            {user?.user_metadata?.role && (
              <div className="space-y-2">
                <Label>الدور</Label>
                <div>
                  <Badge variant={user.user_metadata.role === 'admin' ? 'default' : 'secondary'}>
                    {user.user_metadata.role === 'admin' ? 'مدير' : 'موظف'}
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={updateProfile}>حفظ التغييرات</Button>
          </CardFooter>
        </Card>

        {/* Password Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <CardTitle>تغيير كلمة المرور</CardTitle>
            </div>
            <CardDescription>تأكد من استخدام كلمة مرور قوية</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">كلمة المرور الجديدة</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">تأكيد كلمة المرور الجديدة</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <p className="text-xs text-muted-foreground">6 أحرف على الأقل</p>
          </CardContent>
          <CardFooter>
            <Button onClick={updatePassword}>تحديث كلمة المرور</Button>
          </CardFooter>
        </Card>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              <CardTitle>الحالة</CardTitle>
            </div>
            <CardDescription>تغيير حالة الاتصال الخاصة بك</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="status">حالة الاتصال</Label>
              <Select value={userStatus} onValueChange={(value: any) => updateStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      متصل
                    </div>
                  </SelectItem>
                  <SelectItem value="away">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-500" />
                      بعيد
                    </div>
                  </SelectItem>
                  <SelectItem value="busy">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-red-500" />
                      مشغول
                    </div>
                  </SelectItem>
                  <SelectItem value="offline">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-gray-500" />
                      غير متصل
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                يؤثر على توزيع المحادثات الجديدة عليك
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              <CardTitle>الإشعارات</CardTitle>
            </div>
            <CardDescription>إدارة تفضيلات الإشعارات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>إشعارات البريد الإلكتروني</Label>
                <p className="text-xs text-muted-foreground">تلقي إشعارات عبر البريد</p>
              </div>
              <Switch
                checked={notifications.email}
                onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>إشعارات سطح المكتب</Label>
                <p className="text-xs text-muted-foreground">إشعارات فورية على سطح المكتب</p>
              </div>
              <Switch
                checked={notifications.desktop}
                onCheckedChange={(checked) => setNotifications({ ...notifications, desktop: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>أصوات الإشعارات</Label>
                <p className="text-xs text-muted-foreground">تشغيل صوت عند وصول رسالة</p>
              </div>
              <Switch
                checked={notifications.sound}
                onCheckedChange={(checked) => setNotifications({ ...notifications, sound: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin Settings */}
      {isAdmin && (
        <>
          <Separator className="my-8" />

          <div>
            <h2 className="text-2xl font-bold mb-2">إعدادات الإدارة</h2>
            <p className="text-muted-foreground">إعدادات خاصة بالمدراء فقط</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Chat Distribution Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <CardTitle>توزيع المحادثات</CardTitle>
                </div>
                <CardDescription>كيفية توزيع المحادثات الجديدة على الفريق</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="distribution">طريقة التوزيع</Label>
                  <Select value={chatDistribution} onValueChange={(value: any) => setChatDistribution(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="round_robin">دوري (Round Robin)</SelectItem>
                      <SelectItem value="least_active">الأقل نشاطاً</SelectItem>
                      <SelectItem value="manual">يدوي</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {chatDistribution === 'round_robin' && 'توزيع المحادثات بالتساوي بين الموظفين'}
                    {chatDistribution === 'least_active' && 'توزيع المحادثات للموظف الأقل نشاطاً'}
                    {chatDistribution === 'manual' && 'اختيار الموظف يدوياً لكل محادثة'}
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>التوزيع التلقائي</Label>
                    <p className="text-xs text-muted-foreground">توزيع المحادثات تلقائياً</p>
                  </div>
                  <Switch
                    checked={autoAssign}
                    onCheckedChange={setAutoAssign}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => {
                  toast({
                    title: 'تم الحفظ',
                    description: 'تم حفظ إعدادات التوزيع',
                  });
                }}>
                  حفظ الإعدادات
                </Button>
              </CardFooter>
            </Card>

            {/* Danger Zone Card */}
            <Card className="border-destructive">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-destructive">منطقة الخطر</CardTitle>
                </div>
                <CardDescription>إجراءات لا يمكن التراجع عنها</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>حذف جميع المحادثات</Label>
                  <p className="text-xs text-muted-foreground">حذف جميع المحادثات والرسائل بشكل دائم</p>
                  <Button variant="destructive" size="sm" onClick={() => {
                    if (confirm('هل أنت متأكد من حذف جميع المحادثات؟ هذا الإجراء لا يمكن التراجع عنه!')) {
                      toast({
                        title: 'تم الحذف',
                        description: 'تم حذف جميع المحادثات',
                      });
                    }
                  }}>
                    حذف جميع المحادثات
                  </Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>إعادة تعيين النظام</Label>
                  <p className="text-xs text-muted-foreground">إعادة تعيين جميع الإعدادات للإعدادات الافتراضية</p>
                  <Button variant="outline" size="sm" onClick={() => {
                    if (confirm('هل أنت متأكد من إعادة تعيين النظام؟')) {
                      toast({
                        title: 'تم إعادة التعيين',
                        description: 'تم إعادة تعيين جميع الإعدادات',
                      });
                    }
                  }}>
                    إعادة تعيين النظام
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
