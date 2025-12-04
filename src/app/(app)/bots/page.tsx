'use client';
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BotsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <h2 className="text-2xl font-bold mb-2">صفحة البوتات</h2>
      <p className="text-muted-foreground mb-4">
        هذه الصفحة قيد التطوير
      </p>
      <Button disabled>
        <PlusCircle className="ml-2 h-4 w-4" />
        إضافة بوت جديد
      </Button>
    </div>
  );
}
