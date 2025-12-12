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
  session_id: string;
  remote_id: string;

  // ✅ NEW: preserves phone JID when remote_id becomes LID
  phone_jid?: string | null;

  name: string | null;
  type: 'INDIVIDUAL' | 'GROUP';
  status: 'INBOX' | 'DONE' | 'ARCHIVED';
  is_unread?: boolean;
  last_message?: string;
  last_message_at: Date | string;
  unread_count?: number;
  avatar?: string;
  assigned_to: string | null;
  is_group: boolean;
  is_read: boolean;
  is_muted: boolean;
  is_archived: boolean;
  mode: 'ai' | 'human';
  needs_human: boolean;
  created_at: Date | string;
  updated_at: Date | string;

  // Convenience aliases for backward compatibility
  remoteId?: string;
  isUnread?: boolean;
  lastMessage?: string;
  lastMessageAt?: Date | string;
  assignedTo?: string | null;
  isGroup?: boolean;
  isRead?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  sessionId?: string;
  needsHuman?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Message {
  id: string;
  chat_id: string;
  session_id: string;
  remote_id: string; // WhatsApp JID (phone JID or LID JID)
  sender: string;
  body: string | null;
  timestamp: Date | string;
  is_from_us: boolean;
  media_type: 'image' | 'video' | 'audio' | 'document' | 'sticker' | null;
  media_url: string | null;
  status: 'sent' | 'delivered' | 'read' | 'pending' | 'failed';
  user_id?: string;
  created_at: Date | string;

  // ✅ NEW: WhatsApp provider message id (Baileys msg.key.id / sendResult.key.id)
  provider_message_id?: string | null;
  client_request_id?: string | null;

  // Convenience aliases for backward compatibility
  chatId?: string;
  isFromUs?: boolean;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker' | null;
  mediaUrl?: string | null;
  sessionId?: string;
  createdAt?: Date | string;
}

export interface Bot {
  id: string;
  name: string;
  description: string | null;
  personality: string;
  avatar_url: string | null;
  is_active: boolean;
  temperature: number;
  max_tokens: number;
  user_id: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface BotKnowledge {
  id: string;
  bot_id: string;
  title: string;
  content: string;
  category: string | null;
  keywords: string[];
  is_active: boolean;
  priority: number;
  created_at: Date | string;
  updated_at: Date | string;
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
