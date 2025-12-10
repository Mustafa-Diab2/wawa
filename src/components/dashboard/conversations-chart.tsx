'use client';
import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { supabase } from '@/lib/supabase';

interface ChartData {
  date: string;
  conversations: number;
}

const chartConfig = {
  conversations: {
    label: "المحادثات",
    color: "hsl(var(--primary))",
  },
};

const arabicDays = [
  'اليوم',
  'أمس',
  'قبل يومين',
  'قبل 3 أيام',
  'قبل 4 أيام',
  'قبل 5 أيام',
  'قبل 6 أيام',
];

export default function ConversationsChart() {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChartData();
  }, []);

  const fetchChartData = async () => {
    try {
      const chartData: ChartData[] = [];
      const now = new Date();

      // Fetch data for last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const { count } = await supabase
          .from('chats')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', date.toISOString())
          .lt('created_at', nextDate.toISOString());

        chartData.push({
          date: arabicDays[i] || `قبل ${i} أيام`,
          conversations: count || 0,
        });
      }

      setData(chartData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      // Set empty data on error
      setData(arabicDays.map(day => ({ date: day, conversations: 0 })));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[250px] w-full flex items-center justify-center">
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{
            top: 5,
            right: 10,
            left: -20, // Adjusted for RTL
            bottom: 5,
          }}
          layout="vertical"
        >
            <XAxis type="number" hide />
            <YAxis
                dataKey="date"
                type="category"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                width={80}
                tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }}
            />
            <Tooltip
                cursor={{ fill: 'hsl(var(--muted))' }}
                content={<ChartTooltipContent />}
            />
            <Bar dataKey="conversations" fill="var(--color-conversations)" radius={4} />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
