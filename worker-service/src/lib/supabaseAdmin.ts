import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin Client for server-side operations
// This client bypasses RLS and has full access to the database

// Helper types for database tables
export type Database = {
  public: {
    Tables: {
      whatsapp_sessions: {
        Row: {
          id: string;
          session_id: string;
          owner_id: string;
          qr: string | null;
          has_qr: boolean;
          qr_length: number;
          status: "connecting" | "connected" | "disconnected";
          is_ready: boolean;
          should_disconnect: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          owner_id?: string;
          qr?: string | null;
          has_qr?: boolean;
          qr_length?: number;
          status?: "connecting" | "connected" | "disconnected";
          is_ready?: boolean;
          should_disconnect?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          owner_id?: string;
          qr?: string | null;
          has_qr?: boolean;
          qr_length?: number;
          status?: "connecting" | "connected" | "disconnected";
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
          type: "INDIVIDUAL" | "GROUP";
          status: "INBOX" | "DONE" | "ARCHIVED";
          is_unread: boolean;
          last_message: string | null;
          last_message_at: string;
          unread_count: number; // Added unread_count
          avatar: string | null;
          assigned_to: string | null;
          is_group: boolean;
          is_read: boolean;
          is_muted: boolean;
          is_archived: boolean;
          mode: "ai" | "human";
          needs_human: boolean;
          created_at: string;
          updated_at: string;
          contact_id: string; // Added contact_id
        };
        Insert: {
          id?: string;
          session_id: string;
          remote_id: string;
          name?: string | null;
          type?: "INDIVIDUAL" | "GROUP";
          status?: "INBOX" | "DONE" | "ARCHIVED";
          is_unread?: boolean;
          last_message?: string | null;
          last_message_at?: string;
          unread_count?: number; // Added unread_count
          avatar?: string | null;
          assigned_to?: string | null;
          is_group?: boolean;
          is_read?: boolean;
          is_muted?: boolean;
          is_archived?: boolean;
          mode?: "ai" | "human";
          needs_human?: boolean;
          created_at?: string;
          updated_at?: string;
          contact_id: string; // Added contact_id
        };
        Update: {
          id?: string;
          session_id?: string;
          remote_id?: string;
          name?: string | null;
          type?: "INDIVIDUAL" | "GROUP";
          status?: "INBOX" | "DONE" | "ARCHIVED";
          is_unread?: boolean;
          last_message?: string | null;
          last_message_at?: string;
          unread_count?: number; // Added unread_count
          avatar?: string | null;
          assigned_to?: string | null;
          is_group?: boolean;
          is_read?: boolean;
          is_muted?: boolean;
          is_archived?: boolean;
          mode?: "ai" | "human";
          needs_human?: boolean;
          created_at?: string;
          updated_at?: string;
          contact_id?: string; // Added contact_id
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
          media_type: "image" | "video" | "audio" | "document" | "sticker" | null;
          media_url: string | null;
          status: "sent" | "delivered" | "read" | "pending" | "failed";
          user_id: string | null;
          created_at: string;
          wa_message_id: string; // Added wa_message_id
          from_role: "agent" | "user"; // Added from_role
          direction: "incoming" | "outgoing"; // Added direction
          type: "text" | "image" | "video" | "audio" | "document" | "sticker"; // Added type
        };
        Insert: {
          id?: string;
          chat_id: string;
          session_id: string;
          remote_id?: string;
          sender?: string;
          body?: string | null;
          timestamp?: string;
          is_from_us?: boolean;
          media_type?: "image" | "video" | "audio" | "document" | "sticker" | null;
          media_url?: string | null;
          status?: "sent" | "delivered" | "read" | "pending" | "failed";
          user_id?: string | null;
          created_at?: string;
          wa_message_id?: string; // Added wa_message_id
          from_role?: "agent" | "user"; // Added from_role
          direction?: "incoming" | "outgoing"; // Added direction
          type?: "text" | "image" | "video" | "audio" | "document" | "sticker"; // Added type
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
          media_type?: "image" | "video" | "audio" | "document" | "sticker" | null;
          media_url?: string | null;
          status?: "sent" | "delivered" | "read" | "pending" | "failed";
          user_id?: string | null;
          created_at?: string;
          wa_message_id?: string; // Added wa_message_id
          from_role?: "agent" | "user"; // Added from_role
          direction?: "incoming" | "outgoing"; // Added direction
          type?: "text" | "image" | "video" | "audio" | "document" | "sticker"; // Added type
        };
      };
      contacts: {
        Row: {
          id: string;
          wa_jid: string;
          phone: string;
          display_name: string | null; // Added display_name
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          wa_jid: string;
          phone: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          wa_jid?: string;
          phone?: string;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};

// Lazy initialization to allow environment variables to be loaded first (especially in worker)
let _supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL environment variable");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
  }

  _supabaseAdmin = createClient<Database>(
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

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient<Database>>, {
  get(target, prop) {
    return getSupabaseAdmin()[prop as keyof ReturnType<typeof createClient<Database>>];
  }
});

export type WhatsAppSessionRow = Database["public"]["Tables"]["whatsapp_sessions"]["Row"];
export type ChatRow = Database["public"]["Tables"]["chats"]["Row"];
export type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type ContactRow = Database["public"]["Tables"]["contacts"]["Row"]; // Added ContactRow
