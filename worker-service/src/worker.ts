// @ts-nocheck
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });

import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
  Browsers,
} from "@whiskeysockets/baileys";
import { createHash } from "crypto";

import { supabaseAdmin } from "./lib/supabaseAdmin";
import pino from "pino";
import fs from "fs";
import { callAI } from "./lib/ai-agent";

import { upsertChat, linkLidToPhone, isPhoneJid, isLidJid, normalizeJid } from "./lib/chat-utils";

const sessions = new Map<string, any>();
const syncedSessions = new Set<string>();
const HISTORY_CHAT_LIMIT = 200;
const HISTORY_MESSAGE_LIMIT = 50;
const JID_MAPPING_SOURCE_REMOTE_ALT = "remoteJidAlt";

async function handleJidMapping(params: { sessionId: string; lidJid: string; phoneJid: string; source: string }) {
  const { sessionId, lidJid, phoneJid, source } = params;
  if (!isLidJid(lidJid) || !isPhoneJid(phoneJid)) return;

  console.log(`[Mapping] session=${sessionId} lid=${lidJid} -> phone=${phoneJid} (source=${source})`);

  try {
    await supabaseAdmin
      .from("jid_mappings")
      .upsert({
        session_id: sessionId,
        lid_jid: lidJid,
        phone_jid: phoneJid,
        last_seen_at: new Date().toISOString(),
      })
      .select("id")
      .single();
  } catch (err) {
    console.error(`[Mapping] Failed upsert jid_mappings for ${lidJid}:`, err);
  }

  try {
    await supabaseAdmin
      .from("chats")
      .update({ phone_jid: phoneJid, updated_at: new Date().toISOString() })
      .eq("session_id", sessionId)
      .eq("remote_id", lidJid)
      .or(`phone_jid.is.null,phone_jid.neq.${phoneJid}`);
  } catch (err) {
    console.error(`[Mapping] Failed updating chat for ${lidJid}:`, err);
  }

  try {
    await linkLidToPhone(sessionId, lidJid, phoneJid);
  } catch (err) {
    console.error(`[Mapping] linkLidToPhone error for ${lidJid}:`, err);
  }
}

async function backfillJidMappings(sessionId: string) {
  try {
    const { data: mappings } = await supabaseAdmin
      .from("jid_mappings")
      .select("lid_jid, phone_jid")
      .eq("session_id", sessionId);

    if (!mappings?.length) {
      console.log(`[Backfill] session=${sessionId} no jid_mappings to apply`);
      return;
    }

    let updated = 0;
    for (const mapping of mappings) {
      const lid = mapping.lid_jid;
      const phone = mapping.phone_jid;
      if (!isLidJid(lid) || !isPhoneJid(phone)) continue;

      const { data, error } = await supabaseAdmin
        .from("chats")
        .update({ phone_jid: phone, updated_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("remote_id", lid)
        .is("phone_jid", null)
        .select("id");

      if (error) {
        console.error(`[Backfill] Update failed for ${lid}:`, error);
        continue;
      }
      updated += data?.length || 0;
    }

    console.log(`[Backfill] session=${sessionId} updated ${updated} chats from jid_mappings`);
  } catch (err) {
    console.error(`[Backfill] Error processing mappings for session ${sessionId}:`, err);
  }
}

function computeProviderId(params: {
  waMessageId?: string | null;
  jid: string;
  timestamp: string;
  body: string;
  fromMe: boolean;
}) {
  if (params.waMessageId) return params.waMessageId;
  const hash = createHash("sha1")
    .update(`${params.jid}|${params.timestamp}|${params.body || ""}|${params.fromMe ? "1" : "0"}`)
    .digest("hex")
    .slice(0, 16);
  return `fallback:${hash}`;
}

function parseMessageContent(msg: any) {
  let body = "";
  let mediaType: "image" | "video" | "audio" | "document" | "sticker" | null = null;

  if (msg?.message?.conversation) {
    body = msg.message.conversation;
  } else if (msg?.message?.extendedTextMessage?.text) {
    body = msg.message.extendedTextMessage.text;
  } else if (msg?.message?.imageMessage) {
    body = msg.message.imageMessage.caption || "";
    mediaType = "image";
  } else if (msg?.message?.videoMessage) {
    body = msg.message.videoMessage.caption || "";
    mediaType = "video";
  } else if (msg?.message?.audioMessage) {
    body = "";
    mediaType = "audio";
  } else if (msg?.message?.stickerMessage) {
    body = "";
    mediaType = "sticker";
  } else if (msg?.message?.documentMessage) {
    const fileName = msg.message.documentMessage.fileName || "";
    body = fileName ? `[document] ${fileName}` : "[document]";
    mediaType = "document";
  }

  return { body, mediaType };
}

async function downloadAndUploadMedia(msg: any, mediaType: string, sessionId: string): Promise<string | null> {
  try {
    const buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      {
        logger: pino({ level: "silent" }) as any,
        reuploadRequest: () => Promise.resolve({} as any),
      }
    );
    if (!buffer) return null;
    console.log(`Media download successful for ${mediaType}, upload to Supabase Storage coming soon`);
    return null;
  } catch (error) {
    console.error("Error downloading/uploading media:", error);
    return null;
  }
}

async function loadRecentMessages(sock: any, jid: string, limit: number) {
  try {
    if (typeof sock.loadMessages === "function") {
      const loaded = await sock.loadMessages(jid, limit);
      if (Array.isArray(loaded)) return loaded;
    }
  } catch (err) {
    console.warn(`[HistorySync] loadMessages failed for ${jid}:`, err);
  }

  try {
    if (typeof sock.fetchMessagesFromWA === "function") {
      const loaded = await sock.fetchMessagesFromWA(jid, limit);
      if (Array.isArray(loaded)) return loaded;
    }
  } catch (err) {
    console.warn(`[HistorySync] fetchMessagesFromWA failed for ${jid}:`, err);
  }

  try {
    const storeMessages = sock.store?.messages?.[jid] || sock.store?.messages?.get?.(jid);
    if (storeMessages && Array.isArray(storeMessages)) {
      return storeMessages.slice(-limit);
    }
  } catch (err) {
    console.warn(`[HistorySync] store lookup failed for ${jid}:`, err);
  }

  return [];
}

async function runHistorySync(sessionId: string, sock: any) {
  if (syncedSessions.has(sessionId)) return;

  try {
    let chatIds: string[] = [];

    try {
      if (sock.chats?.all) {
        chatIds = (sock.chats.all() || []).map((c: any) => c.id).filter(Boolean);
      } else if (Array.isArray(sock.chats)) {
        chatIds = sock.chats.map((c: any) => c.id || c.jid).filter(Boolean);
      }
    } catch (err) {
      console.warn(`[HistorySync] unable to read chats for session ${sessionId}:`, err);
    }

    if (!Array.isArray(chatIds)) chatIds = [];
    const recentChatIds = Array.from(new Set(chatIds)).filter((jid) => jid && jid !== "status@broadcast").slice(-HISTORY_CHAT_LIMIT);

    if (recentChatIds.length === 0) {
      console.log(`[HistorySync] session=${sessionId} chatsFetched=0 (skip)`);
      return;
    }

    syncedSessions.add(sessionId);
    console.log(`[HistorySync] session=${sessionId} chatsFetched=${recentChatIds.length}`);

    for (const jid of recentChatIds) {
      const phoneJid = isPhoneJid(jid) ? jid : undefined;
      const { chat } = await upsertChat(sessionId, jid, phoneJid, {
        type: jid.endsWith("@g.us") ? "GROUP" : "INDIVIDUAL",
      });

      const messages = await loadRecentMessages(sock, jid, HISTORY_MESSAGE_LIMIT);
      let inserted = 0;
      let skipped = 0;

      for (const msg of messages) {
        if (!msg?.message || !msg?.key) {
          skipped += 1;
          continue;
        }

        const providerId = msg.key.id;
        if (!providerId) {
          skipped += 1;
          continue;
        }

        const fromMe = msg.key.fromMe ?? false;
        const timestamp =
          typeof msg.messageTimestamp === "number"
            ? new Date(msg.messageTimestamp * 1000).toISOString()
            : new Date().toISOString();

        const body =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          msg.message?.videoMessage?.caption ||
          "";

        let mediaType: "image" | "video" | "audio" | "document" | "sticker" | null = null;
        if (msg.message?.imageMessage) mediaType = "image";
        else if (msg.message?.videoMessage) mediaType = "video";
        else if (msg.message?.audioMessage) mediaType = "audio";
        else if (msg.message?.stickerMessage) mediaType = "sticker";
        else if (msg.message?.documentMessage) mediaType = "document";

        if (!body && !mediaType) {
          skipped += 1;
          continue;
        }

        const { data: existing } = await supabaseAdmin
          .from("messages")
          .select("id")
          .eq("session_id", sessionId)
          .eq("provider_message_id", providerId)
          .limit(1)
          .maybeSingle();

        if (existing?.id) {
          skipped += 1;
          continue;
        }

        const { error: insertError } = await supabaseAdmin.from("messages").insert({
          chat_id: chat.id,
          session_id: sessionId,
          remote_id: jid,
          sender: fromMe ? "agent" : "user",
          body: body || null,
          timestamp,
          is_from_us: fromMe,
          media_type: mediaType,
          media_url: null,
          status: fromMe ? "sent" : "delivered",
          created_at: timestamp,
          provider_message_id: providerId,
        });

        if (insertError) {
          skipped += 1;
          continue;
        }

        inserted += 1;
      }

      console.log(
        `[HistorySync] jid=${jid} messagesFetched=${messages.length} inserted=${inserted} skipped=${skipped}`
      );
    }
  } catch (err) {
    console.error(`[HistorySync] Error for session ${sessionId}:`, err);
  }
}

async function startSession(sessionId: string) {
  if (sessions.has(sessionId)) {
    console.log(`Session already running, skipping: ${sessionId}`);
    return;
  }

  console.log(`Starting session ${sessionId}`);

  try {
    const { state, saveCreds } = await useMultiFileAuthState(`auth_info_baileys/${sessionId}`);

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }) as any),
      },
      printQRInTerminal: false,
      logger: pino({ level: "silent" }) as any,
      browser: Browsers.ubuntu("Chrome"),
      syncFullHistory: true, // Enable full history sync to load old chats
      shouldSyncHistoryMessage: () => true,
      defaultQueryTimeoutMs: undefined,
    });

    sessions.set(sessionId, sock);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (connection === "open") {
        console.log(
          `[Diag] connection.open session=${sessionId} syncFullHistory=${sock?.opts?.syncFullHistory} historyLimits chats=${HISTORY_CHAT_LIMIT} msgs=${HISTORY_MESSAGE_LIMIT}`
        );
      }

      if (qr) {
        console.log(`QR RECEIVED for session ${sessionId} len ${qr.length}`);
        try {
          const { error } = await (supabaseAdmin as any)
            .from("whatsapp_sessions")
            .update({ qr, is_ready: false, updated_at: new Date().toISOString() })
            .eq("id", sessionId);

          if (error) console.error(`Error updating whatsapp_sessions with QR for ${sessionId}:`, error);
          else console.log(`✅ QR Code updated in Supabase (len: ${qr.length})`);
        } catch (e) {
          console.error(`Error updating QR for ${sessionId}:`, e);
        }
      }

      if (connection === "close") {
        const isLoggedOut =
          (lastDisconnect?.error as any)?.output?.statusCode === DisconnectReason.loggedOut;

        console.log(`Connection closed for ${sessionId}. Logged out: ${isLoggedOut}`);
        sessions.delete(sessionId);
        syncedSessions.delete(sessionId);

        if (isLoggedOut) {
          console.log(`Session ${sessionId} logged out. Clearing all chats and restarting...`);
          try {
            await supabaseAdmin.from("chats").delete().eq("session_id", sessionId);
            await supabaseAdmin.from("messages").delete().eq("session_id", sessionId);

            await (supabaseAdmin as any)
              .from("whatsapp_sessions")
              .update({
                is_ready: false,
                qr: "",
                should_disconnect: false,
                updated_at: new Date().toISOString(),
              })
              .eq("id", sessionId);

            setTimeout(() => startSession(sessionId), 2000);
          } catch (e) {
            console.error(`Error handling logout for ${sessionId}:`, e);
          }
        } else {
          console.log(`Connection error for ${sessionId}, reconnecting...`);
          startSession(sessionId);
        }
      } else if (connection === "open") {
        console.log(`Session ${sessionId} connected.`);
        try {
          await (supabaseAdmin as any)
            .from("whatsapp_sessions")
            .update({ is_ready: true, qr: "", updated_at: new Date().toISOString() })
            .eq("id", sessionId);

          console.log(`Fetching group chats for session ${sessionId}...`);
          try {
            const groups = await sock.groupFetchAllParticipating();
            const groupIds = Object.keys(groups);
            console.log(`Found ${groupIds.length} group chats`);

            for (const groupJid of groupIds) {
              const g = groups[groupJid];
              try {
                await upsertChat(sessionId, groupJid, undefined, {
                  type: "GROUP",
                  name: g.subject || groupJid,
                });
              } catch (e) {
                console.error(`Error saving group chat ${groupJid}:`, e);
              }
            }
          } catch (e) {
            console.log(`Could not fetch groups:`, e);
          }

          console.log(`Finished loading chats for session ${sessionId}`);

          await runHistorySync(sessionId, sock);
          await backfillJidMappings(sessionId);

          try {
            const { count: chatCount } = await supabaseAdmin
              .from("chats")
              .select("*", { count: "exact", head: true })
              .eq("session_id", sessionId);
            const { count: msgCount } = await supabaseAdmin
              .from("messages")
              .select("*", { count: "exact", head: true })
              .eq("session_id", sessionId);
            console.log(
              `[Diag] session=${sessionId} dbCounts chats=${chatCount ?? 0} messages=${msgCount ?? 0}`
            );
          } catch (diagErr) {
            console.error(`[Diag] Failed counting records for session ${sessionId}:`, diagErr);
          }
        } catch (e) {
          console.error(`Error updating connected status for ${sessionId}:`, e);
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

    // ==========================
    // chats.set - Load existing chats from WhatsApp
    // ==========================
    sock.ev.on("chats.set", async ({ chats: waChats }) => {
      console.log(`[Worker:ChatsSet] Received ${waChats.length} chats from WhatsApp for session ${sessionId}`);
      if (waChats.length > 0) {
        const first = waChats[0];
        console.log(`[Worker:ChatsSet] sample chat id=${first.id} name=${first.name || (first as any).subject || ""}`);
      }

      for (const waChat of waChats) {
        try {
          const jid = waChat.id;
          if (!jid || jid === "status@broadcast") continue;

          const isGroup = jid.endsWith("@g.us");
          const phoneJidParam = isPhoneJid(jid) ? jid : undefined;

          await upsertChat(sessionId, jid, phoneJidParam, {
            type: isGroup ? "GROUP" : "INDIVIDUAL",
            name: waChat.name || (waChat as any).subject || jid.split("@")[0],
            lastMessage: (waChat as any).lastMessage?.message?.conversation ||
                         (waChat as any).lastMessage?.message?.extendedTextMessage?.text || "",
          });
        } catch (e) {
          console.error(`[Worker:ChatsSet] Error saving chat ${waChat.id}:`, e);
        }
      }
      console.log(`[Worker:ChatsSet] Finished syncing ${waChats.length} chats for session ${sessionId}`);
    });

    // ==========================
    // chats.upsert - Handle new/updated chats
    // ==========================
    sock.ev.on("chats.upsert", async (waChats) => {
      console.log(`[Worker:ChatsUpsert] Received ${waChats.length} chat updates for session ${sessionId}`);
      if (waChats.length > 0) {
        const first = waChats[0];
        console.log(`[Worker:ChatsUpsert] sample chat id=${first.id} name=${first.name || (first as any).subject || ""}`);
      }

      for (const waChat of waChats) {
        try {
          const jid = waChat.id;
          if (!jid || jid === "status@broadcast") continue;

          const isGroup = jid.endsWith("@g.us");
          const phoneJidParam = isPhoneJid(jid) ? jid : undefined;

          await upsertChat(sessionId, jid, phoneJidParam, {
            type: isGroup ? "GROUP" : "INDIVIDUAL",
            name: waChat.name || (waChat as any).subject || jid.split("@")[0],
          });
        } catch (e) {
          console.error(`[Worker:ChatsUpsert] Error saving chat ${waChat.id}:`, e);
        }
      }
    });

    // ==========================
    // contacts.set - Get contact names
    // ==========================
    sock.ev.on("contacts.set", async ({ contacts }) => {
      console.log(`[Worker:ContactsSet] Received ${contacts.length} contacts for session ${sessionId}`);

      for (const contact of contacts) {
        try {
          const jid = contact.id;
          if (!jid || jid === "status@broadcast") continue;

          // Update chat name if we have a contact name
          const name = contact.name || contact.notify || contact.verifiedName;
          if (name) {
            await supabaseAdmin
              .from("chats")
              .update({ name, updated_at: new Date().toISOString() })
              .eq("session_id", sessionId)
              .eq("remote_id", jid);
          }
        } catch (e) {
          console.error(`[Worker:ContactsSet] Error updating contact ${contact.id}:`, e);
        }
      }
    });

    // ==========================
    // contacts.upsert - Handle new/updated contacts
    // ==========================
    sock.ev.on("contacts.upsert", async (contacts) => {
      for (const contact of contacts) {
        try {
          const jid = contact.id;
          if (!jid || jid === "status@broadcast") continue;

          const name = contact.name || contact.notify || contact.verifiedName;
          if (name) {
            await supabaseAdmin
              .from("chats")
              .update({ name, updated_at: new Date().toISOString() })
              .eq("session_id", sessionId)
              .eq("remote_id", jid);
          }
        } catch (e) {
          console.error(`[Worker:ContactsUpsert] Error updating contact ${contact.id}:`, e);
        }
      }
    });

    // ==========================
    // messaging-history.set - Historical messages sync
    // ==========================
    sock.ev.on(
      "messaging-history.set",
      async ({ chats: historyChats, contacts: historyContacts, messages: historyMessages, isLatest }) => {
        const chatCount = (historyChats || []).length;
        const msgCount = (historyMessages || []).length;
        console.log(
          `[Worker:HistorySet] Received history sync: chats=${chatCount} messages=${msgCount} isLatest=${isLatest}`
        );
        if (chatCount > 0) {
          const first = historyChats![0] as any;
          console.log(`[Worker:HistorySet] sample chat id=${first?.id} name=${first?.name || first?.subject || ""}`);
        }
        if (msgCount > 0) {
          const firstMsg = historyMessages![0] as any;
          console.log(
            `[Worker:HistorySet] sample message provider=${firstMsg?.key?.id} jid=${firstMsg?.key?.remoteJid}`
          );
        }

        const lastByChat = new Map<string, { body: string; ts: string }>();

        for (const chat of historyChats || []) {
          const jid = (chat as any).id;
          if (!jid || jid === "status@broadcast") continue;
          const isGroup = jid.endsWith("@g.us");
          const phoneJidParam = isPhoneJid(jid) ? jid : undefined;
          const name =
            (chat as any).name ||
            (chat as any).subject ||
            (chat as any).pushName ||
            (chat as any).pushname ||
            jid.split("@")[0];

          try {
            await upsertChat(sessionId, jid, phoneJidParam, {
              type: isGroup ? "GROUP" : "INDIVIDUAL",
              name,
            });
          } catch (err) {
            console.error(`[Worker:HistorySet] Error saving chat ${jid}:`, err);
          }
        }

        for (const msg of historyMessages || []) {
          try {
            if (!msg.message) continue;

            const jid = msg.key.remoteJid!;
            if (!jid || jid === "status@broadcast") continue;

            const altJidRaw = (msg.key as any).remoteJidAlt || (msg as any).remoteJidAlt || null;
            const altJid = altJidRaw ? normalizeJid(altJidRaw) : null;
            const altIsPhone = altJid ? isPhoneJid(altJid) : false;
            if (isLidJid(jid) && altIsPhone) {
              await handleJidMapping({
                sessionId,
                lidJid: jid,
                phoneJid: altJid,
                source: JID_MAPPING_SOURCE_REMOTE_ALT,
              });
            }

            const timestamp =
              typeof msg.messageTimestamp === "number"
                ? new Date(msg.messageTimestamp * 1000).toISOString()
                : new Date().toISOString();

            const { body, mediaType } = parseMessageContent(msg);
            if (!body && !mediaType) continue;

            const providerId = computeProviderId({
              waMessageId: msg.key.id,
              jid,
              timestamp,
              body,
              fromMe: msg.key.fromMe ?? false,
            });

            const { data: existing } = await supabaseAdmin
              .from("messages")
              .select("id")
              .eq("session_id", sessionId)
              .eq("provider_message_id", providerId)
              .limit(1)
              .maybeSingle();

            if (existing?.id) continue;

            const isPhone = isPhoneJid(jid);
            const phoneJidParam = isPhone ? jid : altIsPhone ? altJid : undefined;
            const { chat } = await upsertChat(sessionId, jid, phoneJidParam, {
              type: jid.endsWith("@g.us") ? "GROUP" : "INDIVIDUAL",
            });

            const { error: insertError } = await supabaseAdmin.from("messages").insert({
              chat_id: chat.id,
              session_id: sessionId,
              remote_id: jid,
              sender: msg.key.fromMe ? "agent" : "user",
              body,
              timestamp,
              is_from_us: msg.key.fromMe ?? false,
              media_type: mediaType,
              media_url: null,
              status: msg.key.fromMe ? "sent" : "delivered",
              created_at: timestamp,
              provider_message_id: providerId,
            });

            if (insertError) {
              if (insertError.code !== "23505") {
                console.error("[Worker:HistorySet] Error inserting message:", insertError);
              }
              continue;
            }

            const prev = lastByChat.get(chat.id);
            if (!prev || new Date(timestamp).getTime() > new Date(prev.ts).getTime()) {
              lastByChat.set(chat.id, { body, ts: timestamp });
            }
          } catch (e) {
            console.error("[Worker:HistorySet] Error processing message:", e);
          }
        }

        for (const [chatId, data] of lastByChat.entries()) {
          try {
            await supabaseAdmin
              .from("chats")
              .update({
                last_message: data.body,
                last_message_at: data.ts,
                unread_count: 0,
                updated_at: new Date().toISOString(),
              })
              .eq("id", chatId);
          } catch (err) {
            console.error(`[Worker:HistorySet] Error updating chat ${chatId}:`, err);
          }
        }

        console.log(`[Worker:HistorySet] Finished processing ${msgCount} historical messages`);
      }
    });
    // ==========================
    // messages.upsert (SOURCE OF TRUTH)
    // ==========================
    sock.ev.on("messages.upsert", async (m) => {
      console.log(`[Worker:MessagesUpsert] Received ${m.messages.length} messages, type=${m.type}`);
      if (m.type !== "notify" && m.type !== "append") return;

      for (const msg of m.messages) {
        try {
          if (!msg.message) continue;

          const jid = msg.key.remoteJid!;
          if (!jid) continue;
          if (jid === "status@broadcast") continue;

          const waMessageId = msg.key.id;
          if (!waMessageId) continue;

          const fromMe = msg.key.fromMe ?? false;

          const timestamp =
            typeof msg.messageTimestamp === "number"
              ? new Date(msg.messageTimestamp * 1000).toISOString()
              : new Date().toISOString();

          // Parse body/media
          let body = "";
          let mediaType: "image" | "video" | "audio" | "document" | "sticker" | null = null;
          let mediaUrl: string | null = null;

          if (msg.message.conversation) {
            body = msg.message.conversation;
          } else if (msg.message.extendedTextMessage?.text) {
            body = msg.message.extendedTextMessage.text;
          } else if (msg.message.imageMessage) {
            body = msg.message.imageMessage.caption || "[image]";
            mediaType = "image";
            mediaUrl = await downloadAndUploadMedia(msg, "image", sessionId);
          } else if (msg.message.videoMessage) {
            body = msg.message.videoMessage.caption || "[video]";
            mediaType = "video";
            mediaUrl = await downloadAndUploadMedia(msg, "video", sessionId);
          } else if (msg.message.audioMessage) {
            body = msg.message.audioMessage.ptt ? "[voice note]" : "[audio]";
            mediaType = "audio";
            mediaUrl = await downloadAndUploadMedia(msg, "audio", sessionId);
          } else if (msg.message.stickerMessage) {
            body = "[sticker]";
            mediaType = "sticker";
            mediaUrl = await downloadAndUploadMedia(msg, "sticker", sessionId);
          } else if (msg.message.documentMessage) {
            const fileName = msg.message.documentMessage.fileName || "document";
            body = `[document] ${fileName}`;
            mediaType = "document";
            mediaUrl = await downloadAndUploadMedia(msg, "document", sessionId);
          }

          // Skip empty/no-media messages (prevents blank rows)
          if ((!body || body.trim() === "") && !mediaType) {
            console.log(`[Worker:Upsert] ⏭️ Skip empty message provider=${waMessageId} jid=${jid}`);
            continue;
          }

          const isPhone = isPhoneJid(jid);
          const isLid = isLidJid(jid);
          const altJidRaw = (msg.key as any).remoteJidAlt || (msg as any).remoteJidAlt || null;
          const altJid = altJidRaw ? normalizeJid(altJidRaw) : null;
          const altIsPhone = altJid ? isPhoneJid(altJid) : false;

          if (isLid && altIsPhone) {
            await handleJidMapping({
              sessionId,
              lidJid: jid,
              phoneJid: altJid,
              source: JID_MAPPING_SOURCE_REMOTE_ALT,
            });
          }

          console.log(
            `[Worker:Upsert] session=${sessionId} jid=${jid} fromMe=${fromMe} provider=${waMessageId} isPhone=${isPhone} isLid=${isLid} alt=${altJid || "N/A"}`
          );

          // ✅ 1) DEDUPE by provider id across session (BEFORE chat upsert)
          const { data: existingByProvider } = await supabaseAdmin
            .from("messages")
            .select("id")
            .eq("session_id", sessionId)
            .eq("provider_message_id", waMessageId)
            .limit(1)
            .maybeSingle();

          if (existingByProvider?.id) {
            console.log(`[Worker:Upsert] ⏭️ Duplicate skipped provider=${waMessageId} existing=${existingByProvider.id}`);
            continue;
          }

          // ✅ 2) FROM-ME RECONCILIATION (ONLY when we can match BODY)
          if (fromMe) {
            const tsDate = new Date(timestamp);
            const tsMillis = isNaN(tsDate.getTime()) ? Date.now() : tsDate.getTime();
            const windowStartIso = new Date(tsMillis - 5 * 60 * 1000).toISOString();

            const { data: pendingRow } = await supabaseAdmin
              .from("messages")
              .select("id, chat_id, body, created_at, status, remote_id")
              .eq("session_id", sessionId)
              .eq("is_from_us", true)
              .is("provider_message_id", null)
              .in("status", ["pending", "sent"])
              .eq("body", body) // ✅ IMPORTANT: match body
              .gte("created_at", windowStartIso)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (pendingRow?.id) {
              const { error: pendingUpdateError } = await supabaseAdmin
                .from("messages")
                .update({
                  provider_message_id: waMessageId,
                  status: "sent",
                  remote_id: jid,
                  timestamp,
                })
                .eq("id", pendingRow.id);

              if (!pendingUpdateError) {
                const { data: pendingChat } = await supabaseAdmin
                  .from("chats")
                  .select("id, phone_jid, remote_id")
                  .eq("id", pendingRow.chat_id)
                  .single();

                const phoneJid =
                  pendingChat?.phone_jid ||
                  (pendingChat && isPhoneJid(pendingChat.remote_id) ? pendingChat.remote_id : undefined);

                if (isLid && phoneJid) {
                  await linkLidToPhone(sessionId, jid, phoneJid);
                  console.log(`[Worker:Upsert] 🔗 Linked LID ${jid} -> phone ${phoneJid} via pending=${pendingRow.id}`);
                }

                console.log(`[Worker:Upsert] ✅ fromMe reconciled provider=${waMessageId} pending=${pendingRow.id}`);
                continue; // ✅ STOP HERE (no insert)
              }

              if (pendingUpdateError.code === "23505") {
                console.log(`[Worker:Upsert] ⏭️ Pending update duplicate provider=${waMessageId} (23505)`);
                continue;
              }

              console.error(`[Worker:Upsert] Error updating pending ${pendingRow.id}:`, pendingUpdateError);
              // fallback to normal flow
            }
          }

          // ✅ 3) Normal flow
          const phoneJidParam = isPhone ? jid : altIsPhone ? altJid : undefined;
          const { chat } = await upsertChat(sessionId, jid, phoneJidParam, {
            type: "INDIVIDUAL",
            lastMessage: body,
          });

          const { error: msgInsertError } = await supabaseAdmin
            .from("messages")
            .insert({
              chat_id: chat.id,
              session_id: sessionId,
              remote_id: jid,
              sender: fromMe ? "agent" : "user",
              body,
              timestamp,
              is_from_us: fromMe,
              media_type: mediaType,
              media_url: mediaUrl,
              status: fromMe ? "sent" : "delivered",
              created_at: timestamp,
              provider_message_id: waMessageId, // ✅ ALWAYS SET
            });

          if (msgInsertError) {
            if (msgInsertError.code === "23505") {
              console.log(`[Worker:Upsert] ⏭️ Duplicate blocked by UNIQUE provider=${waMessageId}`);
              continue;
            }
            console.error(`[Worker:Upsert] Error inserting message:`, msgInsertError);
            continue;
          }

          await supabaseAdmin
            .from("chats")
            .update({
              last_message: body,
              last_message_at: new Date().toISOString(),
              unread_count: fromMe ? chat.unread_count : (chat.unread_count || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", chat.id);

          console.log(`[Worker:Upsert] ✅ Saved message provider=${waMessageId} chat=${chat.id}`);

          // ==========================
          // AI Agent Logic (incoming REAL-TIME messages only, skip historical)
          // ==========================
          const isRealTimeMessage = m.type === "notify";
          if (!fromMe && body && body.trim() !== "" && isRealTimeMessage) {
            try {
              if (!process.env.OPENAI_API_KEY) {
                console.log("[AI] OPENAI_API_KEY missing, skipping AI and marking for human");
                await supabaseAdmin
                  .from("chats")
                  .update({ needs_human: true, mode: "human", updated_at: new Date().toISOString() })
                  .eq("id", chat.id);
                continue;
              }

              const { data: chatData } = await supabaseAdmin
                .from("chats")
                .select("mode, bot_id")
                .eq("id", chat.id)
                .single();

              const customerServiceKeywords = [
                "عايز اكلم خدمة العملاء",
                "حولني خدمة العملاء",
                "اكلم خدمة العملاء",
                "موظف",
                "عايز موظف",
                "تحويل خدمة العملاء",
                "اتكلم مع موظف",
                "عايز اتكلم مع شخص",
              ];

              const messageText = body.toLowerCase().trim();
              const requestsHuman = customerServiceKeywords.some((k) => messageText.includes(k.toLowerCase()));

              if (requestsHuman) {
                await supabaseAdmin.from("chats").update({ mode: "human", needs_human: true }).eq("id", chat.id);

                const confirmationMessage = "تم تحويلك إلى خدمة العملاء. سيقوم أحد موظفينا بالرد عليك قريباً.";

                // ✅ IMPORTANT: send only (DO NOT INSERT MESSAGE HERE)
                await sock.sendMessage(jid, { text: confirmationMessage });

                // chat last_message update only
                await supabaseAdmin
                  .from("chats")
                  .update({
                    last_message: confirmationMessage,
                    last_message_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", chat.id);

                console.log(`[AI] Switched chat ${chat.id} to human mode`);
              } else if (chatData?.mode === "human") {
                console.log(`[AI] Chat ${chat.id} is in human mode, skipping AI`);
              } else {
                const { data: messagesHistory } = await supabaseAdmin
                  .from("messages")
                  .select("body, sender")
                  .eq("chat_id", chat.id)
                  .order("created_at", { ascending: false })
                  .limit(6);

                const conversationHistory = (messagesHistory || [])
                  .reverse()
                  .slice(0, -1)
                  .map((x: any) => ({
                    role: x.sender === "agent" ? ("assistant" as const) : ("user" as const),
                    content: x.body || "",
                  }))
                  .filter((x: any) => x.content.trim() !== "");

                const aiResponse = await callAI(conversationHistory, body, {
                  botId: chatData?.bot_id || undefined,
                  chatId: chat.id,
                });

                // ✅ IMPORTANT: send only (DO NOT INSERT MESSAGE HERE)
                await sock.sendMessage(jid, { text: aiResponse.reply });

                await supabaseAdmin
                  .from("chats")
                  .update({
                    last_message: aiResponse.reply,
                    last_message_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", chat.id);

                if (aiResponse.handoff) {
                  await supabaseAdmin
                    .from("chats")
                    .update({ mode: "human", needs_human: true, updated_at: new Date().toISOString() })
                    .eq("id", chat.id);
                }
              }
            } catch (aiError) {
              console.error(`[AI] Error processing AI for chat ${chat.id}:`, aiError);
            }
          }
        } catch (e) {
          console.error(`Error processing messages.upsert for ${sessionId}:`, e);
        }
      }
    });
  } catch (error) {
    console.error(`Error starting session ${sessionId}:`, error);
    sessions.delete(sessionId);
  }
}

console.log("Starting Worker with Supabase...");

// ==========================
// OUTGOING pending polling
// ==========================
const sendingMessages = new Set<string>();

setInterval(async () => {
  try {
    const { data: pendingMessages, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("status", "pending")
      .is("provider_message_id", null)
      .limit(10);

    if (error) {
      console.error("[Polling] Error fetching pending messages:", error);
      return;
    }

    if (!pendingMessages?.length) return;

    for (const messageData of pendingMessages) {
      const sessionId = messageData.session_id;
      const remoteId = messageData.remote_id;
      const body = messageData.body;
      const messageId = messageData.id;
      const chatId = messageData.chat_id;

      if (sendingMessages.has(messageId)) continue;
      if (!sessions.has(sessionId)) continue;

      sendingMessages.add(messageId);
      const sock = sessions.get(sessionId);

      try {
        const sendResult = await sock.sendMessage(remoteId, { text: body || "" });
        const waMessageId = sendResult?.key?.id || null;
        const actualRemoteJid = sendResult?.key?.remoteJid || null;

        if (actualRemoteJid && actualRemoteJid !== remoteId) {
          const sentToPhone = isPhoneJid(remoteId);
          const returnedLid = isLidJid(actualRemoteJid);
          if (sentToPhone && returnedLid) {
            await linkLidToPhone(sessionId, actualRemoteJid, remoteId);
          }
        }

        const { error: updateError } = await supabaseAdmin
          .from("messages")
          .update({
            status: "sent",
            provider_message_id: waMessageId,
            remote_id: actualRemoteJid || remoteId,
            timestamp: new Date().toISOString(),
          })
          .eq("id", messageId)
          .eq("status", "pending");

        if (updateError) {
          if (updateError.code === "23505") {
            await supabaseAdmin.from("messages").delete().eq("id", messageId);
          } else {
            console.error(`[Worker:Outgoing] ❌ Error updating message:`, updateError);
          }
        } else {
          console.log(`[Worker:Outgoing] ✅ Sent msgId=${messageId} provider=${waMessageId} chat=${chatId}`);
        }
      } catch (e) {
        console.error(`[Worker:Outgoing] ❌ Error sending ${messageId}:`, e);
        await supabaseAdmin.from("messages").update({ status: "failed" }).eq("id", messageId);
      } finally {
        sendingMessages.delete(messageId);
      }
    }
  } catch (e) {
    console.error("[Polling] Error in message polling loop:", e);
  }
}, 3000);

// ==========================
// Sessions polling
// ==========================
setInterval(async () => {
  try {
    const { data: allSessions, error } = await supabaseAdmin.from("whatsapp_sessions").select("*");
    if (error || !allSessions) return;

    for (const sessionData of allSessions) {
      const sessionId = sessionData.id;

      if (sessionData.should_disconnect && sessions.has(sessionId)) {
        const sock = sessions.get(sessionId);
        try {
          await supabaseAdmin.from("chats").delete().eq("session_id", sessionId);
          await supabaseAdmin.from("messages").delete().eq("session_id", sessionId);

          const authPath = path.join(process.cwd(), "auth_info_baileys", sessionId);
          if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });

          sock.logout();
          sessions.delete(sessionId);

          await supabaseAdmin.from("whatsapp_sessions").delete().eq("id", sessionId);
        } catch (e) {
          console.error(`Error during disconnect cleanup for ${sessionId}:`, e);
        }
      } else if (!sessions.has(sessionId)) {
        startSession(sessionId);
      }
    }
  } catch (e) {
    console.error("[Polling] Error in sessions polling loop:", e);
  }
}, 5000);

// Load existing sessions on startup
(async () => {
  const { data: existingSessions } = await supabaseAdmin.from("whatsapp_sessions").select("id");
  if (existingSessions?.length) {
    for (const s of existingSessions) startSession(s.id);
  }
})();

process.on("SIGINT", () => {
  console.log("Shutting down...");
  sessions.forEach((sock) => sock.end(undefined));
  process.exit(0);
});
