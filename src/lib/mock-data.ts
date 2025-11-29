import type { User, Chat, Message, Contact, Category, Bot } from './types';

export const mockUser: User = {
  id: 'user-1',
  name: 'أحمد الرئيسي',
  email: 'ahmad@wacrm.com',
  role: 'ADMIN',
  avatar: 'https://i.pravatar.cc/150?u=user-1',
};

export const mockChats: Chat[] = [
  {
    id: 'chat-1',
    remoteId: '971501234567@c.us',
    name: 'سارة خالد',
    type: 'INDIVIDUAL',
    status: 'INBOX',
    isUnread: true,
    lastMessage: 'تمام، سأرسل لك التفاصيل الآن.',
    lastMessageAt: new Date(Date.now() - 5 * 60 * 1000),
    avatar: 'https://i.pravatar.cc/150?u=sara',
    assignedTo: 'user-1',
  },
  {
    id: 'chat-2',
    remoteId: '971559876543@c.us',
    name: 'محمد عبد الله',
    type: 'INDIVIDUAL',
    status: 'INBOX',
    isUnread: false,
    lastMessage: 'شكرًا جزيلاً على المساعدة!',
    lastMessageAt: new Date(Date.now() - 30 * 60 * 1000),
    avatar: 'https://i.pravatar.cc/150?u=mohamed',
    assignedTo: 'user-1',
  },
  {
    id: 'chat-3',
    remoteId: '966501122334@c.us',
    name: 'فريق التسويق',
    type: 'GROUP',
    status: 'INBOX',
    isUnread: true,
    lastMessage: 'علي: لا تنسوا اجتماع الغد الساعة 10 صباحًا.',
    lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    avatar: 'https://i.pravatar.cc/150?u=marketing-team',
    assignedTo: null,
  },
  {
    id: 'chat-4',
    remoteId: '971528877665@c.us',
    name: 'عميل جديد',
    type: 'INDIVIDUAL',
    status: 'DONE',
    isUnread: false,
    lastMessage: 'تم حل المشكلة، شكرًا.',
    lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    avatar: 'https://i.pravatar.cc/150?u=new-client',
    assignedTo: 'user-1',
  },
  {
    id: 'chat-5',
    remoteId: '96599887766@c.us',
    name: 'مجموعة المشروع',
    type: 'GROUP',
    status: 'ARCHIVED',
    isUnread: false,
    lastMessage: 'تم الانتهاء من المشروع بنجاح.',
    lastMessageAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    avatar: 'https://i.pravatar.cc/150?u=project-group',
    assignedTo: null,
  },
];

export const mockMessages: { [chatId: string]: Message[] } = {
  'chat-1': [
    {
      id: 'msg-1-1',
      chatId: 'chat-1',
      sender: 'سارة خالد',
      body: 'مرحبًا، أود الاستفسار عن باقات الأسعار.',
      timestamp: new Date(Date.now() - 10 * 60 * 1000),
      isFromUs: false,
      mediaType: null,
      mediaUrl: null,
      status: 'read',
    },
    {
      id: 'msg-1-2',
      chatId: 'chat-1',
      sender: 'أحمد الرئيسي',
      body: 'أهلاً بكِ سارة. يسعدنا خدمتك. لدينا عدة باقات تناسب الاحتياجات المختلفة.',
      timestamp: new Date(Date.now() - 8 * 60 * 1000),
      isFromUs: true,
      mediaType: null,
      mediaUrl: null,
      status: 'read',
    },
    {
      id: 'msg-1-3',
      chatId: 'chat-1',
      sender: 'سارة خالد',
      body: 'ممتاز، هل يمكن إرسال تفاصيل الباقة الاحترافية؟',
      timestamp: new Date(Date.now() - 6 * 60 * 1000),
      isFromUs: false,
      mediaType: null,
      mediaUrl: null,
      status: 'read',
    },
    {
      id: 'msg-1-4',
      chatId: 'chat-1',
      sender: 'أحمد الرئيسي',
      body: 'تمام، سأرسل لك التفاصيل الآن.',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      isFromUs: true,
      mediaType: null,
      mediaUrl: null,
      status: 'delivered',
    },
  ],
  'chat-2': [
    {
      id: 'msg-2-1',
      chatId: 'chat-2',
      sender: 'محمد عبد الله',
      body: 'شكرًا جزيلاً على المساعدة!',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      isFromUs: false,
      mediaType: null,
      mediaUrl: null,
      status: 'read',
    },
  ],
  // Add more messages for other chats if needed
};

export const mockContacts: Contact[] = [
  {
    id: 'contact-1',
    name: 'سارة خالد',
    phone: '+971 50 123 4567',
    email: 'sara.k@example.com',
    categoryId: 'cat-1',
    avatar: 'https://i.pravatar.cc/150?u=sara',
  },
  {
    id: 'contact-2',
    name: 'محمد عبد الله',
    phone: '+971 55 987 6543',
    email: 'mo.abdullah@example.com',
    categoryId: 'cat-2',
    avatar: 'https://i.pravatar.cc/150?u=mohamed',
  },
  {
    id: 'contact-3',
    name: 'علي حسن',
    phone: '+966 50 112 2334',
    email: 'ali.h@example.com',
    categoryId: 'cat-1',
    avatar: 'https://i.pravatar.cc/150?u=ali-hassan',
  },
];

export const mockCategories: Category[] = [
  { id: 'cat-1', name: 'عملاء محتملون' },
  { id: 'cat-2', name: 'عملاء حاليون' },
  { id: 'cat-3', name: 'VIP' },
];

export const mockBots: Bot[] = [
  {
    id: 'bot-1',
    name: 'بوت الترحيب',
    type: 'welcome',
    isActive: true,
  },
  {
    id: 'bot-2',
    name: 'بوت الرد الذكي',
    type: 'ai',
    isActive: true,
    aiModel: 'gpt-4o-mini',
    aiPrompt: 'أنت مساعد ذكي لخدمة العملاء. مهمتك هي الإجابة على استفساراتهم بأسلوب ودود ومحترف.',
  },
  {
    id: 'bot-3',
    name: 'بوت الرد التلقائي (خارج أوقات العمل)',
    type: 'auto',
    isActive: false,
  },
];
