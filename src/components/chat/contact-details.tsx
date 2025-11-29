import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { mockUser } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import type { Chat } from "@/lib/types";
import { Mail, Phone, User } from "lucide-react";

interface ContactDetailsProps {
    chat: Chat;
}

export default function ContactDetails({ chat }: ContactDetailsProps) {
  return (
    <>
      <CardHeader className="items-center text-center">
        <Avatar className="h-20 w-20 border-2 border-primary">
          <AvatarImage src={chat.avatar} alt={chat.name || "Chat"} />
          <AvatarFallback>{chat.name ? chat.name.substring(0, 2) : "C"}</AvatarFallback>
        </Avatar>
        <CardTitle className="font-headline">{chat.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Separator />
        <div className="space-y-2 text-sm">
            <h4 className="font-semibold">معلومات الاتصال</h4>
            <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <span>{chat.remoteId.split('@')[0]}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>- لم يضاف بعد -</span>
            </div>
        </div>
        <Separator />
        <div className="space-y-2 text-sm">
            <h4 className="font-semibold">المسؤول</h4>
             <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={mockUser.avatar} alt={mockUser.name}/>
                    <AvatarFallback>{mockUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span>{mockUser.name}</span>
            </div>
        </div>
        <Separator />
         <div className="space-y-3 text-sm">
            <h4 className="font-semibold">الوسوم</h4>
            <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">عميل محتمل</Badge>
                <Badge variant="secondary">مهتم بالباقة السنوية</Badge>
                <Badge variant="outline">+ إضافة وسم</Badge>
            </div>
        </div>
      </CardContent>
    </>
  );
}
