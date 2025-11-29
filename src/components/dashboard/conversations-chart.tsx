'use client';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart";

const data = [
  { date: 'قبل 7 أيام', conversations: 186 },
  { date: 'قبل 6 أيام', conversations: 305 },
  { date: 'قبل 5 أيام', conversations: 237 },
  { date: 'قبل 4 أيام', conversations: 273 },
  { date: 'قبل 3 أيام', conversations: 209 },
  { date: 'أمس', conversations: 214 },
  { date: 'اليوم', conversations: 321 },
];

const chartConfig = {
  conversations: {
    label: "المحادثات",
    color: "hsl(var(--primary))",
  },
};

export default function ConversationsChart() {
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
