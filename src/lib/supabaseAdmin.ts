import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client for server-side operations
// This client bypasses RLS and has full access to the database

// Lazy initialization to allow environment variables to be loaded first (especially in worker)
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  _supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  return _supabaseAdmin;
}

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    return getSupabaseAdmin()[prop as keyof ReturnType<typeof createClient>];
  }
});

// Helper types for database tables
export type Database = {
  public: {
    Tables: {
      whatsapp_sessions: {
        Row: {
          id: string;
          owner_id: string;
          qr: string;
          is_ready: boolean;
          should_disconnect: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          qr?: string;
          is_ready?: boolean;
          should_disconnect?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          qr?: string;
          is_ready?: boolean;
          should_disconnect?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      chats: {
        Row: {
          id: string;
          session_id: string;
          remote_id: string;
          name: string | null;
          type: 'INDIVIDUAL' | 'GROUP';
          status: 'INBOX' | 'DONE' | 'ARCHIVED';
          is_unread: boolean;
          last_message: string | null;
          last_message_at: string;
          avatar: string | null;
          assigned_to: string | null;
          is_group: boolean;
          is_read: boolean;
          is_muted: boolean;
          is_archived: boolean;
          mode: 'ai' | 'human';
          needs_human: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          remote_id: string;
          name?: string | null;
          type?: 'INDIVIDUAL' | 'GROUP';
          status?: 'INBOX' | 'DONE' | 'ARCHIVED';
          is_unread?: boolean;
          last_message?: string | null;
          last_message_at?: string;
          avatar?: string | null;
          assigned_to?: string | null;
          is_group?: boolean;
          is_read?: boolean;
          is_muted?: boolean;
          is_archived?: boolean;
          mode?: 'ai' | 'human';
          needs_human?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          remote_id?: string;
          name?: string | null;
          type?: 'INDIVIDUAL' | 'GROUP';
          status?: 'INBOX' | 'DONE' | 'ARCHIVED';
          is_unread?: boolean;
          last_message?: string | null;
          last_message_at?: string;
          avatar?: string | null;
          assigned_to?: string | null;
          is_group?: boolean;
          is_read?: boolean;
          is_muted?: boolean;
          is_archived?: boolean;
          mode?: 'ai' | 'human';
          needs_human?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          chat_id: string;
          session_id: string;
          remote_id: string;
          sender: string;
          body: string | null;
          timestamp: string;
          is_from_us: boolean;
          media_type: 'image' | 'video' | 'audio' | 'document' | 'sticker' | null;
          media_url: string | null;
          status: 'sent' | 'delivered' | 'read' | 'pending' | 'failed';
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          chat_id: string;
          session_id: string;
          remote_id: string;
          sender: string;
          body?: string | null;
          timestamp?: string;
          is_from_us?: boolean;
          media_type?: 'image' | 'video' | 'audio' | 'document' | 'sticker' | null;
          media_url?: string | null;
          status?: 'sent' | 'delivered' | 'read' | 'pending' | 'failed';
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          chat_id?: string;
          session_id?: string;
          remote_id?: string;
          sender?: string;
          body?: string | null;
          timestamp?: string;
          is_from_us?: boolean;
          media_type?: 'image' | 'video' | 'audio' | 'document' | 'sticker' | null;
          media_url?: string | null;
          status?: 'sent' | 'delivered' | 'read' | 'pending' | 'failed';
          user_id?: string | null;
          created_at?: string;
        };
      };
    };
  };
};

export type WhatsAppSessionRow = Database['public']['Tables']['whatsapp_sessions']['Row'];
export type ChatRow = Database['public']['Tables']['chats']['Row'];
export type MessageRow = Database['public']['Tables']['messages']['Row'];
