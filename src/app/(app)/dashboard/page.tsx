'use client';
import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MessageSquare,
  Bot,
  Clock,
  CheckCircle,
  Archive,
  UserPlus,
  BarChart2,
} from "lucide-react";
import StatCard from "@/components/dashboard/stat-card";
import ConversationsChart from "@/components/dashboard/conversations-chart";
import RecentActivity from "@/components/dashboard/recent-activity";
import { supabase } from '@/lib/supabase';

interface DashboardStats {
  totalChats: number;
  activeChats: number;
  completedChats: number;
  activeBots: number;
  lastMonthChats: number;
  lastWeekChats: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalChats: 0,
    activeChats: 0,
    completedChats: 0,
    activeBots: 0,
    lastMonthChats: 0,
    lastWeekChats: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get total chats
      const { count: totalChats } = await supabase
        .from('chats')
        .select('*', { count: 'exact', head: true });

      // Get active chats (chats with recent activity)
      const { count: activeChats } = await supabase
        .from('chats')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', lastWeek.toISOString());

      // Get completed chats (assuming we have a status field, otherwise use all chats - active)
      const completedChats = (totalChats || 0) - (activeChats || 0);

      // Get active bots
      const { count: activeBots } = await supabase
        .from('bots')
        .select('*', { count: 'exact', head: true })
        .eq('active', true);

      // Get last month's chats for comparison
      const { count: lastMonthChats } = await supabase
        .from('chats')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', lastMonth.toISOString());

      // Get last week's chats for comparison
      const { count: lastWeekChats } = await supabase
        .from('chats')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', lastWeek.toISOString());

      setStats({
        totalChats: totalChats || 0,
        activeChats: activeChats || 0,
        completedChats: completedChats || 0,
        activeBots: activeBots || 0,
        lastMonthChats: lastMonthChats || 0,
        lastWeekChats: lastWeekChats || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate percentage changes
  const monthlyChange = stats.lastMonthChats > 0
    ? ((stats.totalChats - stats.lastMonthChats) / stats.lastMonthChats * 100).toFixed(1)
    : '0';

  const weeklyChange = stats.lastWeekChats > 0
    ? ((stats.activeChats - stats.lastWeekChats) / stats.lastWeekChats * 100).toFixed(1)
    : '0';

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            لوحة التحكم
          </h1>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          لوحة التحكم
        </h1>
        <p className="text-muted-foreground">
          نظرة عامة على نشاطك في WaCRM.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="إجمالي المحادثات"
          value={stats.totalChats.toLocaleString('ar-EG')}
          icon={MessageSquare}
          change={`${monthlyChange > '0' ? '+' : ''}${monthlyChange}% من الشهر الماضي`}
        />
        <StatCard
          title="المحادثات النشطة"
          value={stats.activeChats.toLocaleString('ar-EG')}
          icon={Clock}
          change={`${weeklyChange > '0' ? '+' : ''}${weeklyChange}% من الأسبوع الماضي`}
          variant="default"
        />
        <StatCard
          title="المحادثات المكتملة"
          value={stats.completedChats.toLocaleString('ar-EG')}
          icon={CheckCircle}
          change={`${((stats.completedChats / stats.totalChats) * 100).toFixed(1)}% من الإجمالي`}
        />
        <StatCard
          title="البوتات النشطة"
          value={stats.activeBots.toLocaleString('ar-EG')}
          icon={Bot}
          change="مستقر"
          variant="default"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>نظرة عامة على المحادثات</CardTitle>
            <CardDescription>
              عرض لعدد المحادثات الجديدة خلال آخر 7 أيام.
            </CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <ConversationsChart />
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>النشاطات الأخيرة</CardTitle>
            <CardDescription>
              آخر 5 نشاطات حدثت في حسابك.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentActivity />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
