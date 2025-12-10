'use client';
import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, CheckCircle, MessageSquare, UserPlus, Send } from "lucide-react";
import { supabase } from '@/lib/supabase';

interface Activity {
  icon: any;
  text: string;
  subject: string;
  time: string;
}

function formatTimeAgo(date: string) {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `قبل ${diffMins} دقيقة`;
  if (diffHours < 24) return `قبل ${diffHours} ساعة`;
  return `قبل ${diffDays} يوم`;
}

export default function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentActivities();
  }, []);

  const fetchRecentActivities = async () => {
    try {
      const activitiesList: Activity[] = [];

      // Get recent chats
      try {
        const { data: recentChats } = await supabase
          .from('chats')
          .select('remote_jid, created_at')
          .order('created_at', { ascending: false })
          .limit(3);

        if (recentChats) {
          recentChats.forEach(chat => {
            // Extract phone number or contact name from remote_jid
            const contactName = chat.remote_jid?.split('@')[0] || 'جهة اتصال';
            activitiesList.push({
              icon: MessageSquare,
              text: 'محادثة جديدة مع:',
              subject: contactName,
              time: formatTimeAgo(chat.created_at),
            });
          });
        }
      } catch (error) {
        console.log('Error fetching chats:', error);
      }

      // Get recent bots (skip if table doesn't exist)
      try {
        const { data: recentBots } = await supabase
          .from('bots')
          .select('name, created_at')
          .order('created_at', { ascending: false })
          .limit(2);

        if (recentBots) {
          recentBots.forEach(bot => {
            activitiesList.push({
              icon: Bot,
              text: 'تم إنشاء بوت:',
              subject: bot.name,
              time: formatTimeAgo(bot.created_at),
            });
          });
        }
      } catch (error) {
        console.log('Bots table not found');
      }

      // Get recent campaigns
      const { data: recentCampaigns } = await supabase
        .from('campaigns')
        .select('name, created_at')
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentCampaigns) {
        recentCampaigns.forEach(campaign => {
          activitiesList.push({
            icon: Send,
            text: 'تم إنشاء حملة:',
            subject: campaign.name,
            time: formatTimeAgo(campaign.created_at),
          });
        });
      }

      // Sort by time and take first 5
      activitiesList.sort((a, b) => {
        const aTime = a.time.includes('الآن') ? 0 : parseInt(a.time.match(/\d+/)?.[0] || '999');
        const bTime = b.time.includes('الآن') ? 0 : parseInt(b.time.match(/\d+/)?.[0] || '999');
        return aTime - bTime;
      });

      setActivities(activitiesList.slice(0, 5));
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      // Set empty activities on error
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">لا توجد نشاطات حديثة</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {activities.map((activity, index) => (
        <div key={index} className="flex items-start gap-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <activity.icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="grid gap-1 flex-1">
            <p className="text-sm text-muted-foreground">
              {activity.text}{" "}
              <span className="font-semibold text-foreground">{activity.subject}</span>
            </p>
             <p className="text-xs text-muted-foreground">{activity.time}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
