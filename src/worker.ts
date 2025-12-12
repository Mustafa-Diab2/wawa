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
import { supabaseAdmin } from "./lib/supabaseAdmin";
import pino from "pino";
import fs from "fs";
import { callAI } from "./lib/ai-agent";
import { isPhoneJid, isLidJid, upsertChat, linkLidToPhone } from "./lib/chat-utils";

const sessions = new Map<string, any>();

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
      syncFullHistory: false,
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
          else console.log(`✅ QR Code for session ${sessionId} successfully updated`);
        } catch (e) {
          console.error(`Error updating QR for ${sessionId}:`, e);
        }
      }

      if (connection === "close") {
        const isLoggedOut = (lastDisconnect?.error as any)?.output?.statusCode === DisconnectReason.loggedOut;
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

          console.log(`Finished loading chats for session ${sessionId}`);
        } catch (e) {
          console.error(`Error updating connected status for ${sessionId}:`, e);
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

    // =========================
    // INCOMING / UPSERT EVENTS
    // =========================
    sock.ev.on("messages.upsert", async (m) => {
      console.log("messages.upsert", JSON.stringify(m, null, 2));

      if (m.type === "notify" || m.type === "append") {
        for (const msg of m.messages) {
          if (!msg.message) continue;

          const jid = msg.key.remoteJid!;
          if (!jid) continue;
          if (jid === "status@broadcast") continue;

          const waMessageId = msg.key.id; // <-- WhatsApp provider id
          if (!waMessageId) continue;

          const fromMe = msg.key.fromMe ?? false;
          const timestamp = typeof msg.messageTimestamp === "number"
            ? new Date(msg.messageTimestamp * 1000).toISOString()
            : new Date().toISOString();

          let body = "";
          let mediaType: "image" | "video" | "audio" | "document" | "sticker" | null = null;
          let mediaUrl: string | null = null;

          if (msg.message.conversation) body = msg.message.conversation;
          else if (msg.message.extendedTextMessage?.text) body = msg.message.extendedTextMessage.text;
          else if (msg.message.imageMessage) {
            body = msg.message.imageMessage.caption || "📷 صورة";
            mediaType = "image";
            mediaUrl = await downloadAndUploadMedia(msg, "image", sessionId);
          } else if (msg.message.videoMessage) {
            body = msg.message.videoMessage.caption || "🎥 فيديو";
            mediaType = "video";
            mediaUrl = await downloadAndUploadMedia(msg, "video", sessionId);
          } else if (msg.message.audioMessage) {
            const isPtt = msg.message.audioMessage.ptt;
            body = isPtt ? "🎤 رسالة صوتية" : "🎵 ملف صوتي";
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

          if (!mediaType && (!body || body.trim() === "")) {
            console.log(`[Worker:Incoming] ⏭️ Skip empty message provider=${waMessageId} fromMe=${fromMe}`);
            continue;
          }

          try {
            const isPhone = isPhoneJid(jid);
            const isLid = isLidJid(jid);

            console.log(`[Worker:Incoming] sessionId=${sessionId}, jid=${jid}, isPhone=${isPhone}, isLid=${isLid}`);

            // ✅ DEDUPE by provider id across the session
            const { data: existing } = await supabaseAdmin
              .from("messages")
              .select("id")
              .eq("session_id", sessionId)
              .eq("provider_message_id", waMessageId)
              .limit(1)
              .maybeSingle();

            if (existing?.id) {
              console.log(`[Worker:Incoming] ⏭️ Duplicate skipped provider_message_id=${waMessageId}`);
              continue;
            }

            // ✅ FROM-ME RECONCILIATION: attach provider id to latest pending/sent outgoing row (provider_message_id is NULL)
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
                    created_at: timestamp,
                  })
                  .eq("id", pendingRow.id);

                if (pendingUpdateError) {
                  if (pendingUpdateError.code === "23505") {
                    console.log(`[Worker:Incoming] ⏭️ Duplicate pending row already updated provider_message_id=${waMessageId}`);
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
                    console.log(`[Worker:Incoming] 🔗 Linked LID ${jid} to phone ${phoneJid} via pending message ${pendingRow.id}`);
                  }

                  console.log(`[Worker:Incoming] 🔄 fromMe reconciled provider=${waMessageId} pending=${pendingRow.id} chat=${pendingRow.chat_id} remote=${jid}`);
                  continue;
                }
              }
            }

            const phoneJidParam = isPhone ? jid : undefined;

            const { chat } = await upsertChat(sessionId, jid, phoneJidParam, { type: "INDIVIDUAL" });

            console.log(`[Worker:Incoming] chat.id=${chat.id} remote_id=${chat.remote_id} providerId=${waMessageId} fromMe=${fromMe}`);

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
                provider_message_id: waMessageId, // ✅ مهم
              })
              .select("id")
              .single();

            if (msgError) {
              if (msgError.code === "23505") {
                console.log(`[Worker:Incoming] ⏭️ Duplicate blocked by unique index: ${waMessageId}`);
                continue;
              }
              console.error(`[Worker:Incoming] Error inserting message:`, msgError);
              continue;
            }
            console.log(`[Worker:Incoming] ✅ Inserted message=${insertedMessage?.id} provider=${waMessageId}`);

            await supabaseAdmin
              .from("chats")
              .update({
                last_message: body,
                last_message_at: new Date(),
                unread_count: fromMe ? chat.unread_count : (chat.unread_count || 0) + 1,
                updated_at: new Date().toISOString(),
              })
              .eq("id", chat.id);

            console.log(`[Worker:Incoming] ✅ SUCCESS msg=${insertedMessage?.id} wa=${waMessageId}`);

            // ========= AI LOGIC =========
            if (!fromMe && body && body.trim() !== "") {
              try {
                const { data: chatData } = await supabaseAdmin
                  .from("chats")
                  .select("mode, unread_count, bot_id")
                  .eq("id", chat.id)
                  .single();

                const customerServiceKeywords = [
                  'عايز اكلم خدمة العملاء',
                  'حولني خدمة العملاء',
                  'اكلم خدمة العملاء',
                  'موظف',
                  'عايز موظف',
                  'تحويل خدمة العملاء',
                  'اتكلم مع موظف',
                  'عايز اتكلم مع شخص',
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

                  const confirmationMessage = "تم تحويلك إلى خدمة العملاء. سيقوم أحد موظفينا بالرد عليك قريباً.";

                  // أرسل وسيتم حفظها عبر messages.upsert fromMe
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

                  // أرسل وسيتم تخزينها عبر messages.upsert fromMe
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
