'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  LayoutGrid,
  MessageSquare,
  Bot,
  Users,
  QrCode,
  Settings,
  CircleHelp,
  LogOut,
  UserCog,
  BarChart3,
  Zap,
  Send,
  ChevronDown,
  User,
} from 'lucide-react';
import WaCrmLogo from '../icons/wacrm-logo';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

const menuItems = [
  { href: '/dashboard', label: 'لوحة التحكم', icon: LayoutGrid },
  { href: '/chat', label: 'المحادثات', icon: MessageSquare },
  { href: '/bots', label: 'البوتات', icon: Bot },
  { href: '/responses', label: 'الردود السريعة', icon: Zap },
  { href: '/campaigns', label: 'الحملات', icon: Send },
  { href: '/crm', label: 'إدارة العملاء', icon: Users },
  { href: '/team', label: 'إدارة الفريق', icon: UserCog },
  { href: '/reports', label: 'التقارير', icon: BarChart3 },
  { href: '/connect', label: 'ربط WhatsApp', icon: QrCode },
  { href: '/settings', label: 'الإعدادات', icon: Settings },
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email || '');
      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'مستخدم');
    }
  };

  const isActive = (href: string) => {
    return pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: 'تم تسجيل الخروج',
        description: 'وداعاً! نراك قريباً',
      });
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="w-full">
                  <div className="flex items-center gap-2 flex-1">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userEmail}`} />
                      <AvatarFallback>
                        {userName?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start text-right flex-1">
                      <span className="text-sm font-medium">{userName}</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {userEmail}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 mr-auto" />
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <User className="ml-2 h-4 w-4" />
                  <span>الملف الشخصي</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="ml-2 h-4 w-4" />
                  <span>الإعدادات</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="ml-2 h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
