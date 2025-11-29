import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          الإعدادات
        </h1>
        <p className="text-muted-foreground">
          إدارة إعدادات حسابك وتفضيلاتك.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>الملف الشخصي</CardTitle>
            <CardDescription>
              تحديث معلومات ملفك الشخصي.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">الاسم</Label>
              <Input id="name" defaultValue="أحمد الرئيسي" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" defaultValue="ahmad@wacrm.com" readOnly />
            </div>
          </CardContent>
          <CardFooter>
            <Button>حفظ التغييرات</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>تغيير كلمة المرور</CardTitle>
            <CardDescription>
              تأكد من استخدام كلمة مرور قوية.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">كلمة المرور الحالية</Label>
              <Input id="current-password" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
              <Input id="new-password" type="password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">تأكيد كلمة المرور الجديدة</Label>
              <Input id="confirm-password" type="password" />
            </div>
          </CardContent>
          <CardFooter>
            <Button>تحديث كلمة المرور</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
