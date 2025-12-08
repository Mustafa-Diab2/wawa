'use client';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, TrendingUp, Clock, MessageSquare, Users, Download, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function ReportsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState('7d');
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalMessages: 0,
    avgResponseTime: 0,
    totalChats: 0,
    activeAgents: 0,
    peakHours: '--:-- - --:--',
    commonTags: [] as { name: string; count: number }[],
  });

  // Check auth and load data
  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadStats();
    }
  }, [userId, timeRange]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }
    setUserId(user.id);
  };

  const loadStats = async () => {
    if (!userId) return;

    setIsLoading(true);

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    switch (timeRange) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    try {
      // Load chats count
      const { count: chatsCount } = await supabase
        .from('chats')
        .select('*', { count: 'only', head: true })
        .gte('updated_at', startDate.toISOString());

      // Load messages count
      const { count: messagesCount } = await supabase
        .from('messages')
        .select('*', { count: 'only', head: true })
        .gte('created_at', startDate.toISOString());

      // Load tags
      const { data: tagsData } = await supabase
        .from('chat_tag_relations')
        .select('tag_id, chat_tags(name)')
        .gte('created_at', startDate.toISOString());

      const tagCounts: Record<string, number> = {};
      tagsData?.forEach((rel: any) => {
        const tagName = rel.chat_tags?.name;
        if (tagName) {
          tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
        }
      });

      const commonTags = Object.entries(tagCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      setStats({
        totalMessages: messagesCount || 0,
        avgResponseTime: 145, // TODO: Calculate from actual data
        totalChats: chatsCount || 0,
        activeAgents: 0, // TODO: Calculate from agent_stats
        peakHours: '14:00 - 16:00', // TODO: Calculate from messages timestamps
        commonTags,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل الإحصائيات',
        variant: 'destructive',
      });
    }

    setIsLoading(false);
  };

  const responseTimeData = [
    { hour: '00:00', time: 120 },
    { hour: '04:00', time: 90 },
    { hour: '08:00', time: 180 },
    { hour: '12:00', time: 240 },
    { hour: '16:00', time: 210 },
    { hour: '20:00', time: 150 },
  ];

  const messageVolumeData = [
    { day: 'السبت', count: 234 },
    { day: 'الأحد', count: 189 },
    { day: 'الاثنين', count: 267 },
    { day: 'الثلاثاء', count: 198 },
    { day: 'الأربعاء', count: 223 },
    { day: 'الخميس', count: 245 },
    { day: 'الجمعة', count: 156 },
  ];

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
          <h1 className="text-3xl font-bold">التقارير والتحليلات</h1>
          <p className="text-muted-foreground">تحليل شامل لأداء الفريق والمحادثات</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">آخر 24 ساعة</SelectItem>
              <SelectItem value="7d">آخر 7 أيام</SelectItem>
              <SelectItem value="30d">آخر 30 يوم</SelectItem>
              <SelectItem value="90d">آخر 90 يوم</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="ml-2 h-4 w-4" />
            تصدير PDF
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الرسائل</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 text-green-500 mr-1" />
              +12% عن الأسبوع الماضي
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متوسط وقت الرد</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.floor(stats.avgResponseTime / 60)}:{stats.avgResponseTime % 60}</div>
            <p className="text-xs text-muted-foreground">دقيقة:ثانية</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">المحادثات النشطة</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalChats}</div>
            <p className="text-xs text-muted-foreground">محادثة جارية</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">وقت الذروة</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.peakHours}</div>
            <p className="text-xs text-muted-foreground">أعلى نشاط</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Reports */}
      <Tabs defaultValue="volume" className="space-y-4">
        <TabsList>
          <TabsTrigger value="volume">حجم الرسائل</TabsTrigger>
          <TabsTrigger value="response">أوقات الاستجابة</TabsTrigger>
          <TabsTrigger value="tags">التصنيفات</TabsTrigger>
          <TabsTrigger value="agents">أداء الموظفين</TabsTrigger>
        </TabsList>

        <TabsContent value="volume" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>حجم الرسائل حسب اليوم</CardTitle>
              <CardDescription>عدد الرسائل المستلمة والمرسلة خلال الأسبوع</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {messageVolumeData.map((data) => (
                  <div key={data.day} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-medium">{data.day}</div>
                    <div className="flex-1">
                      <div className="h-8 bg-primary/20 rounded-md relative overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-md"
                          style={{ width: `${(data.count / 300) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-sm text-right">{data.count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="response" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>أوقات الاستجابة حسب الساعة</CardTitle>
              <CardDescription>متوسط وقت الرد على الرسائل خلال اليوم</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {responseTimeData.map((data) => (
                  <div key={data.hour} className="flex items-center gap-4">
                    <div className="w-20 text-sm font-medium">{data.hour}</div>
                    <div className="flex-1">
                      <div className="h-8 bg-blue-100 rounded-md relative overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-md"
                          style={{ width: `${(data.time / 300) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-16 text-sm text-right">{data.time}ث</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>التصنيفات الأكثر استخداماً</CardTitle>
              <CardDescription>توزيع التاجات على المحادثات</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.commonTags.map((tag) => (
                  <div key={tag.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium">{tag.count}</span>
                      </div>
                      <span className="font-medium">{tag.name}</span>
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(tag.count / 200) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>أداء الموظفين</CardTitle>
              <CardDescription>مقارنة أداء أعضاء الفريق</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'أحمد محمد', chats: 45, avgTime: 120, satisfaction: 4.8 },
                  { name: 'سارة علي', chats: 38, avgTime: 140, satisfaction: 4.6 },
                  { name: 'محمد حسن', chats: 32, avgTime: 160, satisfaction: 4.5 },
                  { name: 'فاطمة أحمد', chats: 28, avgTime: 135, satisfaction: 4.7 },
                ].map((agent) => (
                  <div key={agent.name} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{agent.name}</span>
                      <div className="flex gap-4 text-sm">
                        <span>{agent.chats} محادثة</span>
                        <span>{agent.avgTime}ث متوسط</span>
                        <span>⭐ {agent.satisfaction}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
