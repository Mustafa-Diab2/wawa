import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, CheckCircle, MessageSquare, UserPlus } from "lucide-react";

const activities = [
  {
    icon: UserPlus,
    text: "تمت إضافة جهة اتصال جديدة:",
    subject: "ناصر الخليفي",
    time: "قبل 5 دقائق",
  },
  {
    icon: CheckCircle,
    text: "اكتملت محادثة مع:",
    subject: "متجر الأزياء",
    time: "قبل 15 دقيقة",
  },
  {
    icon: MessageSquare,
    text: "رسالة جديدة من:",
    subject: "عميل محتمل",
    time: "قبل ساعة",
  },
  {
    icon: Bot,
    text: "تم إنشاء بوت جديد:",
    subject: "بوت استطلاع الرأي",
    time: "قبل 3 ساعات",
  },
  {
    icon: CheckCircle,
    text: "اكتملت محادثة مع:",
    subject: "فاطمة أحمد",
    time: "قبل 5 ساعات",
  },
];

export default function RecentActivity() {
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
