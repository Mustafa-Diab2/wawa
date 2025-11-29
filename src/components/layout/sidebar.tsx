'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter
} from '@/components/ui/sidebar';
import {
  LayoutGrid,
  MessageSquare,
  Bot,
  Users,
  QrCode,
  Settings,
  CircleHelp,
  LogOut,
} from 'lucide-react';
import WaCrmLogo from '../icons/wacrm-logo';

const menuItems = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutGrid },
  { href: '/chat', label: 'المحادثات', icon: MessageSquare },
  { href: '/bots', label: 'البوتات', icon: Bot },
  { href: '/crm', label: 'إدارة العملاء', icon: Users },
  { href: '/connect', label: 'ربط WhatsApp', icon: QrCode },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

export default function AppSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  };

  return (
    <>
      <SidebarHeader>
        <div className="flex h-12 items-center justify-center gap-2 px-2">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <WaCrmLogo className="h-8 w-8 text-primary" />
            <span className="text-lg font-headline group-data-[collapsible=icon]:hidden">WaCRM</span>
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton
                  isActive={isActive(item.href)}
                  tooltip={{ children: item.label, side: 'left' }}
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={{ children: 'المساعدة', side: 'left' }}>
                <CircleHelp />
                <span>المساعدة</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={{ children: 'تسجيل الخروج', side: 'left' }}>
                <LogOut />
                <span>تسجيل الخروج</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
