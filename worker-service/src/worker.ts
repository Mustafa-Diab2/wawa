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

import { supabaseAdmin } from "./lib/supabaseAdmin";
import pino from "pino";
import fs from "fs";
import { callAI } from "./lib/ai-agent";

import { upsertChat, linkLidToPhone, isPhoneJid, isLidJid } from "./lib/chat-utils";

const sessions = new Map<string, any>();

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
    // messages.upsert (SOURCE OF TRUTH)
    // ==========================
    sock.ev.on("messages.upsert", async (m) => {
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
            body = msg.message.imageMessage.caption || "📷 صورة";
            mediaType = "image";
            mediaUrl = await downloadAndUploadMedia(msg, "image", sessionId);
          } else if (msg.message.videoMessage) {
            body = msg.message.videoMessage.caption || "🎥 فيديو";
            mediaType = "video";
            mediaUrl = await downloadAndUploadMedia(msg, "video", sessionId);
          } else if (msg.message.audioMessage) {
            body = msg.message.audioMessage.ptt ? "🎤 رسالة صوتية" : "🎵 ملف صوتي";
            mediaType = "audio";
            mediaUrl = await downloadAndUploadMedia(msg, "audio", sessionId);
          } else if (msg.message.stickerMessage) {
            body = "🎨 ملصق";
            mediaType = "sticker";
            mediaUrl = await downloadAndUploadMedia(msg, "sticker", sessionId);
          } else if (msg.message.documentMessage) {
            const fileName = msg.message.documentMessage.fileName || "ملف";
            body = `📎 ${fileName}`;
            mediaType = "document";
            mediaUrl = await downloadAndUploadMedia(msg, "document", sessionId);
          }

          // ✅ Skip empty/no-media messages (prevents blank rows)
          if ((!body || body.trim() === "") && !mediaType) {
            console.log(`[Worker:Upsert] ⏭️ Skip empty message provider=${waMessageId} jid=${jid}`);
            continue;
          }

          const isPhone = isPhoneJid(jid);
          const isLid = isLidJid(jid);

          console.log(
            `[Worker:Upsert] session=${sessionId} jid=${jid} fromMe=${fromMe} provider=${waMessageId} isPhone=${isPhone} isLid=${isLid}`
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
          const phoneJidParam = isPhone ? jid : undefined;
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
          // AI Agent Logic (incoming only)
          // ==========================
          if (!fromMe && body && body.trim() !== "") {
            try {
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
