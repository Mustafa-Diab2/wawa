// Load environment variables from .env.local
import { config } from "dotenv";
import path from "path";
config({ path: path.join(process.cwd(), ".env.local") });

import { makeWASocket, useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, downloadMediaMessage } from "@whiskeysockets/baileys";
import { supabaseAdmin } from "./lib/supabaseAdmin";
import pino from "pino";
import fs from "fs";
import { callAI } from "./lib/ai-agent";

const sessions = new Map<string, any>();

// Helper function to download and upload media (simplified for now - using external storage later)
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

        // TODO: Upload to Supabase Storage
        // For now, return null and handle media later
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
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const { state, saveCreds } = await useMultiFileAuthState(`auth_info_baileys/${sessionId}`);

        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }) as any),
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }) as any,
            browser: ["Chrome (Linux)", "", ""],
            syncFullHistory: false,
        });

        sessions.set(sessionId, sock);

        // Handle QR code generation
        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                console.log(`QR RECEIVED for session ${sessionId} len ${qr.length}`);
                try {
                    const { error } = await supabaseAdmin
                        .from("whatsapp_sessions")
                        .upsert(
                            {
                                session_id: sessionId,
                                qr: qr,
                                has_qr: true,
                                qr_length: qr.length,
                                status: "connecting",
                                is_ready: false,
                                updated_at: new Date().toISOString()
                            },
                            { onConflict: "session_id" }
                        );

                    if (error) {
                        console.error(`Error updating whatsapp_sessions with QR for ${sessionId}:`, error);
                    } else {
                        console.log(`✅ QR Code for session ${sessionId} successfully updated in Supabase (len: ${qr.length})`);
                    }
                } catch (e) {
                    console.error(`Error updating QR for ${sessionId}:`, e);
                }
            }

            if (connection === "close") {
                const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(`Connection closed for ${sessionId}. Reconnecting: ${shouldReconnect}`);

                sessions.delete(sessionId);

                if (shouldReconnect) {
                    startSession(sessionId);
                } else {
                    console.log(`Session ${sessionId} logged out. Clearing all chats...`);
                    try {
                        // Delete all chats and messages for this session
                        await supabaseAdmin
                            .from("chats")
                            .delete()
                            .eq("session_id", sessionId);

                        await supabaseAdmin
                            .from("messages")
                            .delete()
                            .eq("session_id", sessionId);

                        console.log(`Deleted all chats for logged out session ${sessionId}`);

                        await supabaseAdmin
                            .from("whatsapp_sessions")
                            .update({
                                is_ready: false,
                                has_qr: false,
                                qr: "",
                                qr_length: 0,
                                status: "disconnected",
                                updated_at: new Date().toISOString()
                            })
                            .eq("session_id", sessionId);

                        console.log(`Session ${sessionId} logged out. Not restarting automatically to avoid loop.`);
                    } catch (e) {
                        console.error(`Error updating logout status for ${sessionId}:`, e);
                    }
                }
            } else if (connection === "open") {
                console.log(`Session ${sessionId} connected.`);
                try {
                    await supabaseAdmin
                        .from("whatsapp_sessions")
                        .update({
                            is_ready: true,
                            has_qr: false,
                            qr: "",
                            qr_length: 0,
                            status: "connected",
                            updated_at: new Date().toISOString()
                        })
                        .eq("session_id", sessionId);

                    console.log(`Fetching chats for session ${sessionId}...`);

                    // Fetch groups
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
                                    }, {
                                        onConflict: "id"
                                    });
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

        // Handle incoming messages
        sock.ev.on("messages.upsert", async (m) => {
            // Log messages.upsert for debugging, as requested by the user.
            console.log("messages.upsert", JSON.stringify(m, null, 2));

            if (m.type === "notify" || m.type === "append") {
                for (const msg of m.messages) {
                    // Skip if no message content
                    if (!msg.message) continue;

                    const jid = msg.key.remoteJid!;
                    if (!jid) continue;

                    // Ignore status broadcasts
                    if (jid === "status@broadcast") continue;

                    const messageId = msg.key.id;
                    if (!messageId) continue;

                    const fromMe = msg.key.fromMe ?? false;
                    const timestamp = typeof msg.messageTimestamp === "number" ? new Date(msg.messageTimestamp * 1000).toISOString() : new Date().toISOString();

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

                    try {
                        // Baileys -> Supabase Integration: Contacts, Chats, Messages

                        // Upsert contact: Retrieve or create a contact entry
                        const phone = jid.replace("@s.whatsapp.net", "");
                        const { data: contact, error: contactError } = await supabaseAdmin
                            .from("contacts")
                            .upsert(
                                { wa_jid: jid, phone },
                                { onConflict: "wa_jid" }
                            )
                            .select()
                            .single();

                        if (contactError || !contact) {
                            console.error(`Error upserting contact ${jid}:`, contactError);
                            continue;
                        }

                        // Upsert chat: Retrieve or create a chat entry for the contact
                        const { data: chat, error: chatError } = await supabaseAdmin
                            .from("chats")
                            .upsert(
                                { contact_id: contact.id, session_id: sessionId, remote_id: jid, type: "INDIVIDUAL" },
                                { onConflict: "contact_id" }
                            )
                            .select()
                            .single();

                        if (chatError || !chat) {
                            console.error(`Error upserting chat for contact ${contact.id}:`, chatError);
                            continue;
                        }

                        // Insert message: Add the new message to the messages table
                        await supabaseAdmin.from("messages").insert({
                            chat_id: chat.id,
                            from_role: fromMe ? "agent" : "user",
                            direction: fromMe ? "outgoing" : "incoming",
                            type: mediaType || "text",
                            body: body,
                            wa_message_id: messageId,
                            session_id: sessionId, // Important for session-specific messages
                            created_at: timestamp,
                        });

                        // Update chat: Update last message, last message timestamp, and unread count
                        await supabaseAdmin
                            .from("chats")
                            .update({
                                last_message: body,
                                last_message_at: new Date(),
                                unread_count: fromMe ? chat.unread_count : (chat.unread_count || 0) + 1,
                                updated_at: new Date().toISOString(),
                            })
                            .eq("id", chat.id);

                        console.log(`Saved message ${messageId} to chat ${chat.id}`);

                        // AI Agent Logic - Only for incoming messages (not from us)
                        if (!fromMe && body && body.trim() !== "") {
                            try {
                                // Get chat data (re-fetch for \'mode\' if it was just created or updated externally)
                                const { data: chatData } = await supabaseAdmin
                                    .from("chats")
                                    .select("mode, unread_count")
                                    .eq("id", chat.id)
                                    .single();

                                // Check chat mode
                                if (chatData?.mode === "human") {
                                    console.log(`[AI] Chat ${chat.id} is in human mode, skipping AI`);
                                } else {
                                    // Mode is \'ai\' - call AI agent
                                    console.log(`[AI] Chat ${chat.id} is in AI mode, calling AI agent...`);

                                    // Get conversation history (last 5 messages)
                                    const { data: messagesHistory } = await supabaseAdmin
                                        .from("messages")
                                        .select("body, from_role")
                                        .eq("chat_id", chat.id)
                                        .order("created_at", { ascending: false })
                                        .limit(6);

                                    const conversationHistory = (messagesHistory || [])
                                        .reverse()
                                        .slice(0, -1)
                                        .map((msg: any) => ({
                                            role: msg.from_role === "agent" ? ("assistant" as const) : ("user" as const),
                                            content: msg.body || "",
                                        }))
                                        .filter((m) => m.content.trim() !== "");

                                    // Call AI
                                    const aiResponse = await callAI(conversationHistory, body);

                                    // Send reply via WhatsApp
                                    await sock.sendMessage(jid, { text: aiResponse.reply });
                                    console.log(`[AI] Sent reply to ${jid}`);

                                    // Save AI message to Supabase
                                    const aiMessageId = `ai_${Date.now()}`;
                                    await supabaseAdmin
                                        .from("messages")
                                        .insert({
                                            id: aiMessageId,
                                            chat_id: chat.id,
                                            session_id: sessionId,
                                            wa_message_id: aiMessageId,
                                            from_role: "agent",
                                            direction: "outgoing",
                                            type: "text",
                                            body: aiResponse.reply,
                                            created_at: new Date().toISOString(),
                                        });

                                    // Update chat\'s last message and unread count for AI response
                                    await supabaseAdmin
                                        .from("chats")
                                        .update({
                                            last_message: aiResponse.reply,
                                            last_message_at: new Date().toISOString(),
                                            // No change to unread_count for outgoing AI messages
                                            updated_at: new Date().toISOString(),
                                        })
                                        .eq("id", chat.id);

                                    // Handle handoff if requested
                                    if (aiResponse.handoff) {
                                        console.log(`[AI] Handoff requested for chat ${chat.id}: ${aiResponse.handoff_reason}`);

                                        await supabaseAdmin
                                            .from("chats")
                                            .update({
                                                mode: "human",
                                                needs_human: true,
                                                updated_at: new Date().toISOString(),
                                            })
                                            .eq("id", chat.id);

                                        console.log(`[AI] Chat ${chat.id} switched to human mode`);
                                    }
                                }
                            } catch (aiError) {
                                console.error(`[AI] Error processing AI for chat ${chat.id}:`, aiError);
                            }
                        }

                    } catch (e) {
                        console.error(`Error saving message for ${sessionId}:`, e);
                    }
                }
            }
        });

        // Handle chats (initial load, not related to messages.upsert)
        sock.ev.on("chats.upsert", async (chats) => {
            console.log(`Received ${chats.length} chats for session ${sessionId}`);
            for (const chat of chats) {
                const chatId = chat.id;
                if (!chatId) continue;
                try {
                    await supabaseAdmin
                        .from("chats")
                        .upsert({
                            id: chatId,
                            session_id: sessionId,
                            remote_id: chatId,
                            name: chat.name || null,
                            updated_at: new Date().toISOString()
                        }, {
                            onConflict: "id"
                        });
                } catch (e) {
                    console.error(`Error saving chat ${chatId}:`, e);
                }
            }
        });

    } catch (error) {
        console.error(`Error starting session ${sessionId}:`, error);
        sessions.delete(sessionId);
    }
}

console.log("Starting Worker with Supabase...");

// Listen for outgoing messages using Supabase Realtime
supabaseAdmin
    .channel("messages-channel")
    .on(
        "postgres_changes",
        {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: "status=eq.pending"
        },
        async (payload) => {
            const messageData = payload.new;
            const sessionId = messageData.session_id;
            const remoteId = messageData.remote_id;
            const body = messageData.body;
            const messageId = messageData.id;

            if (sessions.has(sessionId)) {
                const sock = sessions.get(sessionId);
                console.log(`[Worker] Sending message ${messageId} to ${remoteId}`);
                try {
                    await sock.sendMessage(remoteId, { text: body || "" });

                    await supabaseAdmin
                        .from("messages")
                        .update({
                            status: "sent",
                            updated_at: new Date().toISOString()
                        })
                        .eq("id", messageId);

                    console.log(`[Worker] ✅ Message ${messageId} sent successfully`);
                } catch (e) {
                    console.error(`[Worker] ❌ Error sending message ${messageId}:`, e);
                    await supabaseAdmin
                        .from("messages")
                        .update({ status: "failed" })
                        .eq("id", messageId);
                }
            } else {
                console.warn(`[Worker] ⚠️ Session ${sessionId} not found in active sessions`);
            }
        }
    )
    .subscribe();

// Polling function to check for new sessions every 5 seconds
console.log("[Worker] Setting up polling for new sessions (every 5 seconds)...");
setInterval(async () => {
    try {
        const { data: allSessions, error } = await supabaseAdmin
            .from("whatsapp_sessions")
            .select("*");

        if (error) {
            console.error("[Polling] Error fetching sessions:", error);
            return;
        }

        if (!allSessions) return;

        for (const sessionData of allSessions) {
            const sessionId = sessionData.id;

            // Check if session should disconnect
            if (sessionData.should_disconnect && sessions.has(sessionId)) {
                console.log(`[Polling] Session ${sessionId} should disconnect`);
                const sock = sessions.get(sessionId);

                try {
                    // Delete all chats and messages
                    await supabaseAdmin
                        .from("chats")
                        .delete()
                        .eq("session_id", sessionId);

                    await supabaseAdmin
                        .from("messages")
                        .delete()
                        .eq("session_id", sessionId);

                    console.log(`Deleted all chats for session ${sessionId}`);

                    // Delete auth state files
                    const authPath = path.join(process.cwd(), "auth_info_baileys", sessionId);
                    try {
                        if (fs.existsSync(authPath)) {
                            fs.rmSync(authPath, { recursive: true, force: true });
                            console.log(`✅ Deleted auth state for session ${sessionId}`);
                        }
                    } catch (err) {
                        console.error(`❌ Error deleting auth state for session ${sessionId}:`, err);
                    }

                    // Reset the session document
                    await supabaseAdmin
                        .from("whatsapp_sessions")
                        .update({
                            is_ready: false,
                            has_qr: false,
                            qr: "",
                            qr_length: 0,
                            status: "disconnected",
                            should_disconnect: false,
                            updated_at: new Date().toISOString()
                        })
                        .eq("session_id", sessionId);

                    console.log(`Logging out session ${sessionId}...`);
                    sock.logout();
                    sessions.delete(sessionId);
                } catch (e) {
                    console.error(`Error during disconnect cleanup for ${sessionId}:`, e);
                }
            }
            // Start session if not already started
            else if (!sessions.has(sessionId)) {
                console.log(`[Polling] ✅ New session detected: ${sessionId}`);
                startSession(sessionId);
            }
        }
    } catch (e) {
        console.error("[Polling] Error in polling loop:", e);
    }
}, 5000);

// Load existing sessions on startup
(async () => {
    console.log("[Worker] Querying existing sessions from whatsapp_sessions table...");
    const { data: existingSessions, error } = await supabaseAdmin
        .from("whatsapp_sessions")
        .select("id");

    if (error) {
        console.error("[Worker] ❌ Error querying sessions:", error);
    } else if (existingSessions) {
        console.log(`[Worker] ✅ Found ${existingSessions.length} existing sessions:`, existingSessions);
        for (const session of existingSessions) {
            console.log(`[Worker] Starting session from DB: ${session.id}`);
            startSession(session.id);
        }
    } else {
        console.log("[Worker] No existing sessions found in database");
    }
})();

// Keep the process alive
process.on("SIGINT", () => {
    console.log("Shutting down...");
    sessions.forEach(sock => sock.end(undefined));
    process.exit(0);
});
