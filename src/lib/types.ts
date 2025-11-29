import type { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'AGENT';
  avatar: string;
}

export interface Chat {
  id: string;
  remoteId: string;
  name: string | null;
  type: 'INDIVIDUAL' | 'GROUP';
  status: 'INBOX' | 'DONE' | 'ARCHIVED';
  isUnread: boolean;
  lastMessage: string;
  lastMessageAt: Date;
  avatar: string;
  assignedTo: string | null;
}

export interface Message {
  id: string;
  chatId: string;
  sender: string;
  body: string | null;
  timestamp: Date;
  isFromUs: boolean;
  mediaType: 'image' | 'video' | 'audio' | 'document' | null;
  mediaUrl: string | null;
  status: 'sent' | 'delivered' | 'read';
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  categoryId: string | null;
  avatar: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Bot {
  id: string;
  name: string;
  type: 'welcome' | 'auto' | 'survey' | 'ai';
  isActive: boolean;
  aiModel?: string;
  aiPrompt?: string;
}

export interface WhatsAppSession {
    id: string;
    ownerId: string;
    qr: string;
    isReady: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
