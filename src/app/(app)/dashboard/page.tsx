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

export default function DashboardPage() {
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
          value="1,254"
          icon={MessageSquare}
          change="+20.1% من الشهر الماضي"
        />
        <StatCard
          title="المحادثات النشطة"
          value="87"
          icon={Clock}
          change="+15.2% من الأسبوع الماضي"
          variant="default"
        />
        <StatCard
          title="المحادثات المكتملة"
          value="1,098"
          icon={CheckCircle}
          change="+5.6% من الشهر الماضي"
        />
        <StatCard
          title="البوتات النشطة"
          value="3"
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
