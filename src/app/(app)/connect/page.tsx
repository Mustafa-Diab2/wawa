import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import Image from "next/image";
import WhatsAppIcon from "@/components/icons/whatsapp-icon";

export default function ConnectPage() {
  // This would come from a real-time state
  const connectionStatus: "loading" | "connected" | "disconnected" = "disconnected";

  const renderStatus = () => {
    switch (connectionStatus) {
      case "connected":
        return (
          <Badge className="bg-green-500 hover:bg-green-600 gap-2">
            <CheckCircle className="h-4 w-4" />
            متصل
          </Badge>
        );
      case "disconnected":
        return (
          <Badge variant="destructive" className="gap-2">
            <XCircle className="h-4 w-4" />
            غير متصل
          </Badge>
        );
      case "loading":
        return (
          <Badge variant="secondary" className="gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري الاتصال...
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center items-center">
            <WhatsAppIcon className="h-12 w-12 text-green-500 mb-2"/>
          <CardTitle className="font-headline text-2xl">ربط حساب WhatsApp</CardTitle>
          <CardDescription>
            امسح رمز الاستجابة السريعة (QR) باستخدام تطبيق WhatsApp على هاتفك.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="p-4 bg-white rounded-lg shadow-inner">
            {connectionStatus === "disconnected" ? (
              <Image
                src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ExampleQRCode"
                alt="QR Code"
                width={200}
                height={200}
              />
            ) : (
                 <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-100 rounded-md">
                    {connectionStatus === 'connected' ? <CheckCircle className="h-16 w-16 text-green-500" /> : <Loader2 className="h-16 w-16 animate-spin text-primary" />}
                 </div>
            )}
          </div>
          <div className="flex items-center gap-4">
              <span className="text-sm font-medium">الحالة:</span>
              {renderStatus()}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            تحديث الرمز
          </Button>
          <Button variant="destructive" disabled={connectionStatus !== "connected"}>
            قطع الاتصال
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
