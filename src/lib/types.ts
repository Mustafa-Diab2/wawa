export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
  avatar: string;
}

export interface WhatsAppSession {
    id: string;
    ownerId: string;
    qr: string;
    isReady: boolean;
    shouldDisconnect?: boolean;
    createdAt: Date | string;
    updatedAt: Date | string;
}

export interface Chat {
  id: string;
  remoteId: string;
  name: string | null;
  type: 'INDIVIDUAL' | 'GROUP';
  status: 'INBOX' | 'DONE' | 'ARCHIVED';
  isUnread?: boolean;
  lastMessage?: string;
  lastMessageAt: Date | string;
  unread_count?: number; // Added unread_count
  contacts?: { phone: string; display_name: string | null } | null; // Added nested contacts
  avatar?: string;
  assignedTo: string | null;
  isGroup: boolean;
  isRead: boolean;
  isMuted: boolean;
  isArchived: boolean;
  sessionId: string;
  mode: 'ai' | 'human';
  needsHuman: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Message {
  id: string;
  chatId: string;
  remoteId: string; // WhatsApp JID (e.g., "201234567890@s.whatsapp.net")
  sender: string;
  body: string | null;
  timestamp: Date | string;
  isFromUs: boolean;
  mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker' | null;
  mediaUrl: string | null;
  status: 'sent' | 'delivered' | 'read' | 'pending' | 'failed';
  userId?: string;
  sessionId: string;
  createdAt: Date | string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  categoryId: string | null;
  avatar: string;
  userId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Category {
  id: string;
  name: string;
  userId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Bot {
  id: string;
  name: string;
  type: 'welcome' | 'auto' | 'survey' | 'ai';
  isActive: boolean;
  aiModel?: string;
  aiPrompt?: string;
  userId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}
