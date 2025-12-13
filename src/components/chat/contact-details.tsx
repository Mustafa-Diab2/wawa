import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { mockUser } from "@/lib/mock-data";
import { formatE164FromJid, getDisplayJid, getDisplayName, needsMapping } from "@/lib/phone-display";
import type { Chat } from "@/lib/types";
import { Mail, Phone } from "lucide-react";

interface ContactDetailsProps {
  chat: Chat;
}

export default function ContactDetails({ chat }: ContactDetailsProps) {
  const displayDigits = getDisplayJid(chat);
  const displayPhone = formatE164FromJid(chat.phone_jid || (chat as any).phoneJid || null);
  const displayName = getDisplayName(chat);
  const mappingNeeded = needsMapping(chat);

  return (
    <div dir="rtl">
      <CardHeader className="items-center text-center space-y-2">
        <Avatar className="h-20 w-20 border-2 border-primary">
          <AvatarImage src={(chat as any).avatar} alt={displayName} />
          <AvatarFallback>{displayName.substring(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2 justify-center">
          <CardTitle className="font-headline">{displayName}</CardTitle>
          {mappingNeeded && (
            <Badge variant="destructive" className="text-[10px]">
              يحتاج ربط
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Separator />
        <div className="space-y-2 text-sm">
          <h4 className="font-semibold">معلومات الاتصال</h4>
          <div className="flex items-center gap-2 text-muted-foreground" dir="ltr">
            <Phone className="h-4 w-4" />
            <span>{displayPhone || displayDigits || "Unknown number"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <span>- لا يوجد بريد -</span>
          </div>
        </div>
        <Separator />
        <div className="space-y-2 text-sm">
          <h4 className="font-semibold">المسؤول</h4>
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={mockUser.avatar} alt={mockUser.name} />
              <AvatarFallback>{mockUser.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span>{mockUser.name}</span>
          </div>
        </div>
        <Separator />
        <div className="space-y-3 text-sm">
          <h4 className="font-semibold">الوسوم</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">عميل جديد</Badge>
            <Badge variant="secondary">يحتاج متابعة</Badge>
            <Badge variant="outline">بدون وسوم</Badge>
          </div>
        </div>
      </CardContent>
    </div>
  );
}
