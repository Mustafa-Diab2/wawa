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
  Browsers
} from "@whiskeysockets/baileys";
import { createHash } from "crypto";
import { supabaseAdmin } from "./lib/supabaseAdmin";
import pino from "pino";
import fs from "fs";
import { callAI } from "./lib/ai-agent";
import { isPhoneJid, isLidJid, upsertChat, linkLidToPhone } from "./lib/chat-utils";

const sessions = new Map<string, any>();
const syncedSessions = new Set<string>();
const sessionChatJids = new Map<string, Set<string>>();
const HISTORY_CHAT_LIMIT = 200;
const HISTORY_MESSAGE_LIMIT = 50;

const mediaPlaceholders: Record<string, string> = {
  image: "[image]",
  video: "[video]",
  audio: "[audio]",
  sticker: "[sticker]",
  document: "[document]",
};

function recordChatJid(sessionId: string, jid: string) {
  if (!jid || jid === "status@broadcast") return;
  const set = sessionChatJids.get(sessionId) || new Set<string>();
  set.add(jid);
  sessionChatJids.set(sessionId, set);
}

function computeProviderId(params: {
  waMessageId?: string | null;
  jid: string;
  timestamp: string;
  body: string;
  fromMe: boolean;
}) {
  if (params.waMessageId) return params.waMessageId;
  const hash = createHash("sha1").update(params.body || "").digest("hex").slice(0, 10);
  return `fallback:${params.jid}:${params.timestamp}:${hash}:${params.fromMe ? "1" : "0"}`;
}

function parseMessageContent(msg: any) {
  let body = "";
  let mediaType: "image" | "video" | "audio" | "document" | "sticker" | null = null;

  if (msg?.message?.conversation) {
    body = msg.message.conversation;
  } else if (msg?.message?.extendedTextMessage?.text) {
    body = msg.message.extendedTextMessage.text;
  } else if (msg?.message?.imageMessage) {
    body = msg.message.imageMessage.caption || mediaPlaceholders.image;
    mediaType = "image";
  } else if (msg?.message?.videoMessage) {
    body = msg.message.videoMessage.caption || mediaPlaceholders.video;
    mediaType = "video";
  } else if (msg?.message?.audioMessage) {
    body = msg.message.audioMessage.ptt ? mediaPlaceholders.audio : mediaPlaceholders.audio;
    mediaType = "audio";
  } else if (msg?.message?.stickerMessage) {
    body = mediaPlaceholders.sticker;
    mediaType = "sticker";
  } else if (msg?.message?.documentMessage) {
    const fileName = msg.message.documentMessage.fileName || mediaPlaceholders.document;
    body = `${mediaPlaceholders.document} ${fileName}`;
    mediaType = "document";
  }

  return { body, mediaType };
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
    const cached = sessionChatJids.get(sessionId) || new Set<string>();
    let chatIds = Array.from(cached);

    if (chatIds.length === 0 && sock.chats) {
      try {
        if (typeof sock.chats.all === "function") {
          chatIds = (sock.chats.all() || []).map((c: any) => c.id).filter(Boolean);
        } else if (Array.isArray(sock.chats)) {
          chatIds = sock.chats.map((c: any) => c.id || c.jid).filter(Boolean);
        }
      } catch (err) {
        console.warn(`[HistorySync] unable to read sock.chats for session ${sessionId}:`, err);
      }
    }

    const uniqueChatIds = Array.from(new Set(chatIds)).filter((jid) => jid && jid !== "status@broadcast");
    const recentChatIds = uniqueChatIds.slice(-HISTORY_CHAT_LIMIT);

    if (recentChatIds.length === 0) {
      console.log(`[HistorySync] session=${sessionId} chatsFetched=0 (skip)`);
      return;
    }

    syncedSessions.add(sessionId);
    console.log(`[HistorySync] session=${sessionId} chatsFetched=${recentChatIds.length}`);

    for (const jid of recentChatIds) {
      recordChatJid(sessionId, jid);
      const phoneJid = isPhoneJid(jid) ? jid : undefined;
      const { chat } = await upsertChat(sessionId, jid, phoneJid, {
        type: jid.endsWith("@g.us") ? "GROUP" : "INDIVIDUAL",
      });

      const messages = await loadRecentMessages(sock, jid, HISTORY_MESSAGE_LIMIT);
      let inserted = 0;
      let skipped = 0;

      for (const msg of messages) {
        const key = msg?.key || {};
        const remoteJid = key.remoteJid || jid;
        const fromMe = key.fromMe ?? false;
        const timestamp =
          typeof msg?.messageTimestamp === "number"
            ? new Date(msg.messageTimestamp * 1000).toISOString()
            : new Date().toISOString();
        const { body, mediaType } = parseMessageContent(msg);
        if ((!body || body.trim() === "") && !mediaType) {
          skipped += 1;
          continue;
        }

        const providerId = computeProviderId({
          waMessageId: key.id,
          jid: remoteJid,
          timestamp,
          body,
          fromMe,
        });

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
          remote_id: remoteJid,
          sender: fromMe ? "agent" : "user",
          body,
          timestamp,
          is_from_us: fromMe,
          media_type: mediaType,
          media_url: null,
          status: fromMe ? "sent" : "delivered",
          created_at: timestamp,
          provider_message_id: providerId,
        });

        if (insertError) {
          if (insertError.code === "23505") {
            skipped += 1;
            continue;
          }
          console.error(`[HistorySync] Failed inserting message for ${remoteJid}:`, insertError);
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

async function downloadAndUploadMedia(msg: any, mediaType: string, sessionId: string): Promise<string | null> {
  try {
    const buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      {
        logger: pino({ level: "silent" }) as any,
        reuploadRequest: () => Promise.resolve({} as any)
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
      syncFullHistory: true,
      defaultQueryTimeoutMs: undefined,
    });

    sessions.set(sessionId, sock);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`QR RECEIVED for session ${sessionId} len ${qr.length}`);
        try {
          const { error } = await (supabaseAdmin as any)
            .from("whatsapp_sessions")
            .update({
              qr: qr,
              is_ready: false,
              updated_at: new Date().toISOString()
            })
            .eq("id", sessionId);

          if (error) console.error(`Error updating whatsapp_sessions with QR for ${sessionId}:`, error);
          else console.log(`ƒo. QR Code for session ${sessionId} successfully updated`);
        } catch (e) {
          console.error(`Error updating QR for ${sessionId}:`, e);
        }
      }

      if (connection === "close") {
        const isLoggedOut = (lastDisconnect?.error as any)?.output?.statusCode === DisconnectReason.loggedOut;
        console.log(`Connection closed for ${sessionId}. Logged out: ${isLoggedOut}`);

        sessions.delete(sessionId);
        syncedSessions.delete(sessionId);
        sessionChatJids.delete(sessionId);

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
                updated_at: new Date().toISOString()
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
            .update({
              is_ready: true,
              qr: "",
              updated_at: new Date().toISOString()
            })
            .eq("id", sessionId);

          console.log(`Fetching chats for session ${sessionId}...`);
          try {
            const groups = await sock.groupFetchAllParticipating();
            const groupIds = Object.keys(groups);
            console.log(`Found ${groupIds.length} group chats`);

            for (const chatId of groupIds) {
              const chat = groups[chatId];
              try {
                recordChatJid(sessionId, chatId);
                await supabaseAdmin
                  .from("chats")
                  .upsert({
                    id: chatId,
                    session_id: sessionId,
                    remote_id: chatId,
                    name: chat.subject || chat.id,
                    type: "GROUP",
                    is_group: true,
                    last_message_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }, { onConflict: "id" });
              } catch (e) {
                console.error(`Error saving group chat ${chatId}:`, e);
              }
            }
          } catch (e) {
            console.log(`Could not fetch groups:`, e);
          }

          await runHistorySync(sessionId, sock);
          console.log(`Finished loading chats for session ${sessionId}`);
        } catch (e) {
          console.error(`Error updating connected status for ${sessionId}:`, e);
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

    // =========================
    // Chats sync (initial + updates)
    // =========================
    sock.ev.on("chats.set", async ({ chats: waChats }) => {
      console.log(`[Worker:ChatsSet] Received ${waChats.length} chats for session ${sessionId}`);
      for (const waChat of waChats) {
        try {
          const jid = waChat.id;
          if (!jid || jid === "status@broadcast") continue;
          recordChatJid(sessionId, jid);

          const isGroup = jid.endsWith("@g.us");
          const phoneJidParam = isPhoneJid(jid) ? jid : undefined;
          const { body: lastMessage } = parseMessageContent(
            waChat.lastMessage?.message ? waChat.lastMessage : { message: waChat.lastMessage }
          );

          await upsertChat(sessionId, jid, phoneJidParam, {
            type: isGroup ? "GROUP" : "INDIVIDUAL",
            name: waChat.name || (waChat as any).subject || jid.split("@")[0],
            lastMessage,
          });
        } catch (e) {
          console.error(`[Worker:ChatsSet] Error saving chat ${waChat.id}:`, e);
        }
      }

      await runHistorySync(sessionId, sock);
    });

    sock.ev.on("chats.upsert", async (waChats) => {
      for (const waChat of waChats) {
        try {
          const jid = waChat.id;
          if (!jid || jid === "status@broadcast") continue;
          recordChatJid(sessionId, jid);

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

    // =========================
    // History sync events
    // =========================
    sock.ev.on("messaging-history.set", async ({ chats: historyChats = [], messages: historyMessages = [], isLatest }) => {
      console.log(`[HistorySet] chats=${historyChats.length} messages=${historyMessages.length} isLatest=${isLatest}`);

      const lastByChat = new Map<string, { body: string; ts: string }>();

      for (const chat of historyChats) {
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
          console.error(`[HistorySet] Error upserting chat ${jid}:`, err);
        }
      }

      for (const msg of historyMessages || []) {
        try {
          if (!msg?.message || !msg?.key?.remoteJid) continue;
          const jid = msg.key.remoteJid;
          if (jid === "status@broadcast") continue;

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

          const fromMe = msg.key.fromMe ?? false;
          const phoneJidParam = isPhoneJid(jid) ? jid : undefined;
          const { chat } = await upsertChat(sessionId, jid, phoneJidParam, {
            type: jid.endsWith("@g.us") ? "GROUP" : "INDIVIDUAL",
          });

          const { error: insertError } = await supabaseAdmin.from("messages").insert({
            chat_id: chat.id,
            session_id: sessionId,
            remote_id: jid,
            sender: fromMe ? "agent" : "user",
            body,
            timestamp,
            is_from_us: fromMe,
            media_type: mediaType,
            media_url: null,
            status: fromMe ? "sent" : "delivered",
            created_at: timestamp,
            provider_message_id: providerId,
          });

          if (insertError) {
            if (insertError.code !== "23505") {
              console.error(`[HistorySet] Insert error for ${jid}:`, insertError);
            }
            continue;
          }

          const prev = lastByChat.get(chat.id);
          if (!prev || new Date(timestamp).getTime() > new Date(prev.ts).getTime()) {
            lastByChat.set(chat.id, { body, ts: timestamp });
          }
        } catch (err) {
          console.error(`[HistorySet] Error processing history message:`, err);
        }
      }

      for (const [chatId, data] of lastByChat.entries()) {
        try {
          await supabaseAdmin
            .from("chats")
            .update({
              last_message: data.body,
              last_message_at: data.ts,
              updated_at: new Date().toISOString(),
            })
            .eq("id", chatId);
        } catch (err) {
          console.error(`[HistorySet] Error updating chat last_message for ${chatId}:`, err);
        }
      }
    });

    // =========================
    // INCOMING / UPSERT EVENTS
    // =========================
    sock.ev.on("messages.upsert", async (m) => {
      console.log("messages.upsert", JSON.stringify(m, null, 2));

      if (m.type === "notify" || m.type === "append") {
        for (const msg of m.messages) {
          if (!msg.message) continue;

          const jid = msg.key.remoteJid!;
          if (!jid || jid === "status@broadcast") continue;
          recordChatJid(sessionId, jid);

          const fromMe = msg.key.fromMe ?? false;
          const timestamp =
            typeof msg.messageTimestamp === "number"
              ? new Date(msg.messageTimestamp * 1000).toISOString()
              : new Date().toISOString();

          const parsed = parseMessageContent(msg);
          let body = parsed.body;
          let mediaType = parsed.mediaType;
          let mediaUrl: string | null = null;

          if (msg.message?.imageMessage) {
            mediaUrl = await downloadAndUploadMedia(msg, "image", sessionId);
          } else if (msg.message?.videoMessage) {
            mediaUrl = await downloadAndUploadMedia(msg, "video", sessionId);
          } else if (msg.message?.audioMessage) {
            mediaUrl = await downloadAndUploadMedia(msg, "audio", sessionId);
          } else if (msg.message?.stickerMessage) {
            mediaUrl = await downloadAndUploadMedia(msg, "sticker", sessionId);
          } else if (msg.message?.documentMessage) {
            mediaUrl = await downloadAndUploadMedia(msg, "document", sessionId);
          }

          if (!mediaType && (!body || body.trim() === "")) {
            console.log(`[Worker:Incoming] skip empty message provider=${msg.key.id} fromMe=${fromMe}`);
            continue;
          }

          const providerId = computeProviderId({
            waMessageId: msg.key.id,
            jid,
            timestamp,
            body,
            fromMe,
          });

          try {
            const isPhone = isPhoneJid(jid);
            const isLid = isLidJid(jid);

            console.log(
              `[Worker:Incoming] sessionId=${sessionId}, jid=${jid}, fromMe=${fromMe}, provider=${providerId}`
            );

            const { data: existing } = await supabaseAdmin
              .from("messages")
              .select("id")
              .eq("session_id", sessionId)
              .eq("provider_message_id", providerId)
              .limit(1)
              .maybeSingle();

            if (existing?.id) {
              console.log(`[Worker:Incoming] Duplicate skipped provider_message_id=${providerId}`);
              continue;
            }

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
                .eq("body", body)
                .gte("created_at", windowStartIso)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (pendingRow?.id) {
                const { error: pendingUpdateError } = await supabaseAdmin
                  .from("messages")
                  .update({
                    provider_message_id: providerId,
                    status: "sent",
                    remote_id: jid,
                    timestamp,
                    created_at: timestamp,
                  })
                  .eq("id", pendingRow.id);

                if (pendingUpdateError) {
                  if (pendingUpdateError.code === "23505") {
                    console.log(
                      `[Worker:Incoming] Duplicate pending row already updated provider_message_id=${providerId}`
                    );
                    continue;
                  }
                  console.error(`[Worker:Incoming] Error updating pending message ${pendingRow.id}:`, pendingUpdateError);
                } else {
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
                    console.log(
                      `[Worker:Incoming] Linked LID ${jid} to phone ${phoneJid} via pending message ${pendingRow.id}`
                    );
                  }

                  console.log(
                    `[Worker:Incoming] fromMe reconciled provider=${providerId} pending=${pendingRow.id} chat=${pendingRow.chat_id} remote=${jid}`
                  );
                  continue;
                }
              }
            }

            const phoneJidParam = isPhone ? jid : undefined;

            const { chat } = await upsertChat(sessionId, jid, phoneJidParam, {
              type: "INDIVIDUAL",
              lastMessage: body,
            });

            console.log(
              `[Worker:Incoming] chat.id=${chat.id} remote_id=${chat.remote_id} providerId=${providerId} fromMe=${fromMe}`
            );

            const { data: insertedMessage, error: msgError } = await supabaseAdmin
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
                provider_message_id: providerId,
              })
              .select("id")
              .single();

            if (msgError) {
              if (msgError.code === "23505") {
                console.log(`[Worker:Incoming] Duplicate blocked by unique index: ${providerId}`);
                continue;
              }
              console.error(`[Worker:Incoming] Error inserting message:`, msgError);
              continue;
            }
            console.log(`[Worker:Incoming] Saved message=${insertedMessage?.id} provider=${providerId}`);

            await supabaseAdmin
              .from("chats")
              .update({
                last_message: body,
                last_message_at: timestamp,
                unread_count: fromMe ? chat.unread_count : (chat.unread_count || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", chat.id);

            console.log(`[Worker:Incoming] SUCCESS msg=${insertedMessage?.id} wa=${providerId}`);

            // ========= AI LOGIC =========
            if (!fromMe && body && body.trim() !== "") {
              try {
                const { data: chatData } = await supabaseAdmin
                  .from("chats")
                  .select("mode, unread_count, bot_id")
                  .eq("id", chat.id)
                  .single();

                const customerServiceKeywords = [
                  '???? ???? ???? ???????',
                  '????? ???? ???????',
                  '???? ???? ???????',
                  '????',
                  '???? ????',
                  '????? ???? ???????',
                  '????? ?? ????',
                  '???? ????? ?? ???',
                ];

                const messageText = (body || '').toLowerCase().trim();
                const requestsHuman = customerServiceKeywords.some(keyword =>
                  messageText.includes(keyword.toLowerCase())
                );

                if (requestsHuman) {
                  await supabaseAdmin.from("chats").update({
                    mode: "human",
                    needs_human: true,
                  }).eq("id", chat.id);

                  const confirmationMessage = "?? ?????? ??? ???? ???????. ????? ??? ??????? ????? ???? ??????.";

                  // ???? ????? ????? ??? messages.upsert fromMe
                  await sock.sendMessage(jid, { text: confirmationMessage });

                } else if (chatData?.mode === "human") {
                  console.log(`[AI] human mode, skip`);
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
                    .map((msg: any) => ({
                      role: msg.sender === "agent" ? ("assistant" as const) : ("user" as const),
                      content: msg.body || "",
                    }))
                    .filter((m) => m.content.trim() !== "");

                  const botId = chatData?.bot_id || undefined;

                  const aiResponse = await callAI(conversationHistory, body, {
                    botId,
                    chatId: chat.id
                  });

                  // ???? ????? ??????? ??? messages.upsert fromMe
                  await sock.sendMessage(jid, { text: aiResponse.reply });

                  if (aiResponse.handoff) {
                    await supabaseAdmin.from("chats").update({
                      mode: "human",
                      needs_human: true,
                      updated_at: new Date().toISOString(),
                    }).eq("id", chat.id);
                  }
                }
              } catch (aiError) {
                console.error(`[AI] Error:`, aiError);
              }
            }

          } catch (e) {
            console.error(`Error saving message for ${sessionId}:`, e);
          }
        }
      }
    });

  } catch (error) {
    console.error(`Error starting session ${sessionId}:`, error);
    sessions.delete(sessionId);
  }
}

console.log("Starting Worker with Supabase...");

const sendingMessages = new Set<string>();

console.log("[Worker] Setting up polling for pending messages (every 3 seconds)...");
setInterval(async () => {
  try {
    const { data: pendingMessages, error } = await supabaseAdmin
      .from("messages")
      .select("*")
      .eq("status", "pending")
      .is("provider_message_id", null)
      .order("created_at", { ascending: true })
      .limit(10);

    if (error) {
      console.error("[Polling] Error fetching pending messages:", error);
      return;
    }

    if (pendingMessages && pendingMessages.length > 0) {
      console.log(`[Polling] Found ${pendingMessages.length} pending messages`);
      for (const messageData of pendingMessages) {
        const sessionId = messageData.session_id;
        const remoteId = messageData.remote_id;
        const body = messageData.body;
        const messageId = messageData.id;

        if (sendingMessages.has(messageId)) continue;

        if (sessions.has(sessionId)) {
          sendingMessages.add(messageId);
          const sock = sessions.get(sessionId);
          const chatId = messageData.chat_id;

          console.log(`[Worker:Outgoing] Sending: msgId=${messageId}, chatId=${chatId}, to=${remoteId}`);

          try {
            const sendResult = await sock.sendMessage(remoteId, { text: body || "" });

            const actualRemoteJid = sendResult?.key?.remoteJid;
            const waMessageId = sendResult?.key?.id;

            console.log(`[Worker:Outgoing] Sent: waMessageId=${waMessageId}, actualJid=${actualRemoteJid}`);

            if (actualRemoteJid && actualRemoteJid !== remoteId && chatId) {
              const isPhoneRemote = isPhoneJid(remoteId);
              const isLidActual = isLidJid(actualRemoteJid);

              if (isPhoneRemote && isLidActual) {
                console.log(`[Worker:Outgoing] 🔗 Discovered LID mapping: phone=${remoteId} -> lid=${actualRemoteJid}`);
                await linkLidToPhone(sessionId, actualRemoteJid, remoteId);
              }
            }

            // ✅ update نفس صف الـ pending: status + provider_message_id + remote_id الحقيقي
            if (waMessageId) {
              const { data: existingByProvider } = await supabaseAdmin
                .from("messages")
                .select("id")
                .eq("session_id", sessionId)
                .eq("provider_message_id", waMessageId)
                .limit(1)
                .maybeSingle();

              if (existingByProvider?.id && existingByProvider.id !== messageId) {
                console.log(`[Worker:Outgoing] ⏭️ provider_message_id already recorded on ${existingByProvider.id}, deleting pending ${messageId}`);
                await supabaseAdmin.from("messages").delete().eq("id", messageId);
                continue;
              }
            }

            const { error: updateError } = await supabaseAdmin
              .from("messages")
              .update({
                status: "sent",
                provider_message_id: waMessageId || null,
                remote_id: actualRemoteJid || remoteId,
              })
              .eq("id", messageId)
              .eq("status", "pending");

            if (updateError) {
              if (updateError.code === "23505") {
                console.warn(`[Worker:Outgoing] Duplicate provider_message_id=${waMessageId}, removing pending id=${messageId}`);
                await supabaseAdmin.from("messages").delete().eq("id", messageId);
              } else {
                console.error(`[Worker:Outgoing] ❌ Error updating message:`, updateError);
              }
            } else {
              console.log(`[Worker:Outgoing] ✅ Updated pending id=${messageId} provider_message_id=${waMessageId} remote=${actualRemoteJid || remoteId}`);
            }

          } catch (e) {
            console.error(`[Worker] ❌ Error sending message ${messageId}:`, e);
            await supabaseAdmin.from("messages").update({ status: "failed" }).eq("id", messageId);
          } finally {
            sendingMessages.delete(messageId);
          }
        }
      }
    }
  } catch (e) {
    console.error("[Polling] Error in message polling loop:", e);
  }
}, 3000);

console.log("[Worker] Setting up polling for new sessions (every 5 seconds)...");
setInterval(async () => {
  try {
    const { data: allSessions, error } = await supabaseAdmin.from("whatsapp_sessions").select("*");
    if (error) {
      console.error("[Polling] Error fetching sessions:", error);
      return;
    }
    if (!allSessions) return;

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
    console.error("[Polling] Error in polling loop:", e);
  }
}, 5000);

(async () => {
  console.log("[Worker] Querying existing sessions...");
  const { data: existingSessions, error } = await supabaseAdmin.from("whatsapp_sessions").select("id");
  if (error) console.error("[Worker] ❌ Error:", error);
  else if (existingSessions) {
    for (const session of existingSessions) startSession(session.id);
  }
})();

process.on("SIGINT", () => {
  console.log("Shutting down...");
  sessions.forEach(sock => sock.end(undefined));
  process.exit(0);
});
