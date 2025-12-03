import type { FieldValue, Timestamp } from 'firebase/firestore';

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
    createdAt: Timestamp | FieldValue;
    updatedAt: Timestamp | FieldValue;
}

export interface Chat {
  id: string;
  remoteId: string;
  name: string | null;
  type: 'INDIVIDUAL' | 'GROUP';
  status: 'INBOX' | 'DONE' | 'ARCHIVED';
  isUnread?: boolean;
  lastMessage?: string;
  lastMessageAt: Timestamp;
  avatar?: string;
  assignedTo: string | null;
  isGroup: boolean;
  isRead: boolean;
  isMuted: boolean;
  isArchived: boolean;
  sessionId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Message {
  id: string;
  chatId: string;
  sender: string;
  body: string | null;
  timestamp: Timestamp;
  isFromUs: boolean;
  mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker' | null;
  mediaUrl: string | null;
  status: 'sent' | 'delivered' | 'read';
  userId?: string;
  sessionId: string;
  createdAt: Timestamp;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  categoryId: string | null;
  avatar: string;
  userId: string;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

export interface Category {
  id: string;
  name: string;
  userId: string;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

export interface Bot {
  id: string;
  name: string;
  type: 'welcome' | 'auto' | 'survey' | 'ai';
  isActive: boolean;
  aiModel?: string;
  aiPrompt?: string;
  userId: string;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}
