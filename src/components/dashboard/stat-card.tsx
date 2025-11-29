import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  change: string;
  variant?: "default" | "positive" | "negative";
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  change,
  variant = "default",
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p
          className={cn(
            "text-xs text-muted-foreground",
            variant === "positive" && "text-emerald-500",
            variant === "negative" && "text-red-500"
          )}
        >
          {change}
        </p>
      </CardContent>
    </Card>
  );
}
