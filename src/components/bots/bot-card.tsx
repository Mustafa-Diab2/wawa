import { Bot as BotIcon, Edit, MoreVertical } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Bot } from "@/lib/types";

interface BotCardProps {
  bot: Bot;
}

const botTypeTranslations: { [key in Bot['type']]: string } = {
    welcome: 'ترحيب',
    auto: 'رد تلقائي',
    survey: 'استطلاع',
    ai: 'ذكاء اصطناعي'
}

export default function BotCard({ bot }: BotCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <BotIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="font-headline text-lg">{bot.name}</CardTitle>
              <CardDescription>
                <Badge variant="secondary">{botTypeTranslations[bot.type]}</Badge>
              </CardDescription>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>
                <Edit className="mr-2 h-4 w-4" />
                تعديل
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground line-clamp-2 h-10">
            {bot.aiPrompt || `بوت ${botTypeTranslations[bot.type]} لإدارة المحادثات.`}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between">
        <span className="text-sm font-medium">
          {bot.isActive ? "فعّال" : "غير فعّال"}
        </span>
        <Switch checked={bot.isActive} aria-label="تفعيل البوت" />
      </CardFooter>
    </Card>
  );
}
