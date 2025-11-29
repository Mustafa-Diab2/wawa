'use client';
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter } from "@/components/ui/dialog";
import type { Bot } from '@/lib/types';

export default function BotForm() {
    const [botType, setBotType] = useState<Bot['type']>('welcome');
  
    return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="name" className="text-right">
          اسم البوت
        </Label>
        <Input id="name" defaultValue="بوت ترحيبي جديد" className="col-span-3" />
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="type" className="text-right">
          نوع البوت
        </Label>
        <Select onValueChange={(value: Bot['type']) => setBotType(value)} defaultValue={botType}>
          <SelectTrigger className="col-span-3">
            <SelectValue placeholder="اختر نوع البوت" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="welcome">بوت ترحيب</SelectItem>
            <SelectItem value="auto">رد تلقائي</SelectItem>
            <SelectItem value="survey">استطلاع رأي</SelectItem>
            <SelectItem value="ai">بوت ذكاء اصطناعي</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {botType === 'ai' && (
        <>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="aiModel" className="text-right">
                    نموذج AI
                </Label>
                <Select defaultValue="gpt-4o-mini">
                    <SelectTrigger className="col-span-3">
                        <SelectValue placeholder="اختر نموذج" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                        <SelectItem value="gpt-4">gpt-4</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="aiPrompt" className="text-right pt-2">
                    موجه الأوامر (Prompt)
                </Label>
                <Textarea id="aiPrompt" placeholder="أنت مساعد خدمة عملاء..." className="col-span-3" />
            </div>
        </>
      )}
      <DialogFooter>
        <Button type="submit">حفظ</Button>
      </DialogFooter>
    </div>
  );
}
