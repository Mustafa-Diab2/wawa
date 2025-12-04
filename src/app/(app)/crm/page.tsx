'use client';
import { Users } from "lucide-react";

export default function CRMPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <Users className="h-16 w-16 mb-4 text-muted-foreground" />
      <h2 className="text-2xl font-bold mb-2">إدارة العملاء (CRM)</h2>
      <p className="text-muted-foreground">
        هذه الصفحة قيد التطوير
      </p>
    </div>
  );
}
