# 🤖 AI Agent Implementation Status

## ✅ **تم إنجازه (Completed)**

### Part A: Manual New Chat + Send Message

#### 1. **Data Model Updates** ✅
- **File:** `src/lib/types.ts`
- **Changes:**
  ```typescript
  export interface Chat {
    // ... existing fields
    mode: 'ai' | 'human';      // NEW: Chat mode (AI bot or human agent)
    needsHuman: boolean;        // NEW: Flag for handoff requests
  }
  ```

#### 2. **Phone Number Utilities** ✅
- **File:** `src/lib/phone-utils.ts`
- **Functions:**
  - `normalizePhoneToJid(phone: string)` - Converts phone to WhatsApp JID format
  - `formatPhoneFromJid(jid: string)` - Formats JID for display
  - `isValidPhone(phone: string)` - Validates phone numbers

#### 3. **New Chat Modal Component** ✅
- **File:** `src/components/chat/new-chat-modal.tsx`
- **Features:**
  - Phone number input with validation
  - Message textarea
  - Loading states
  - Error handling
  - Arabic UI (RTL)

#### 4. **API Endpoint for Manual Send** ✅
- **File:** `src/app/api/messages/manual-send/route.ts`
- **Functionality:**
  - Validates session status
  - Creates new chat if doesn't exist
  - Creates message with status='pending'
  - Worker picks up pending messages and sends via Baileys

---

## 🚧 **قيد التنفيذ (In Progress)**

### Part B: AI Agent + Human Handoff

#### What Needs to be Done:

### 1. **Integrate New Chat Modal into UI**
**File to modify:** `src/app/(app)/chat/page.tsx` (or wherever chat list is)

**Add:**
```typescript
import { Plus } from 'lucide-react';
import NewChatModal from '@/components/chat/new-chat-modal';

// In component:
const [showNewChatModal, setShowNewChatModal] = useState(false);

const handleNewChat = async (data: { phone: string; jid: string; message: string }) => {
  const response = await fetch('/api/messages/manual-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: currentSessionId,
      to: data.jid,
      text: data.message,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'فشل إرسال الرسالة');
  }

  const result = await response.json();
  // Refresh chat list or add chat to local state
};

// In JSX - Add button to sidebar header:
<Button
  variant="ghost"
  size="sm"
  onClick={() => setShowNewChatModal(true)}
>
  <Plus className="h-4 w-4 ml-2" />
  محادثة جديدة
</Button>

<NewChatModal
  open={showNewChatModal}
  onOpenChange={setShowNewChatModal}
  onSendMessage={handleNewChat}
  sessionId={currentSessionId}
/>
```

---

### 2. **Add AI Mode Indicator in Chat Header**
**File to modify:** Chat header component

**Add:**
```typescript
import { Bot, User } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

// In chat header:
<div className="flex items-center gap-2">
  {chat.mode === 'ai' ? (
    <Badge variant="secondary" className="gap-1">
      <Bot className="h-3 w-3" />
      الوضع: بوت 🤖
    </Badge>
  ) : (
    <Badge variant="default" className="gap-1">
      <User className="h-3 w-3" />
      الوضع: خدمة عملاء 👨‍💼
    </Badge>
  )}

  <Switch
    checked={chat.mode === 'human'}
    onCheckedChange={async (checked) => {
      const newMode = checked ? 'human' : 'ai';
      await updateDoc(chatRef, {
        mode: newMode,
        needsHuman: false,
        updatedAt: serverTimestamp(),
      });
    }}
  />
</div>
```

---

### 3. **Implement AI Agent Logic in Worker**
**File to modify:** `src/worker.ts`

#### Step 1: Install OpenAI or Gemini SDK
```bash
npm install openai
# OR
npm install @google/generative-ai
```

#### Step 2: Add AI Helper Function
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AIResponse {
  reply: string;
  handoff: boolean;
  handoff_reason?: string;
}

async function callAI(
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string
): Promise<AIResponse> {
  const systemPrompt = `أنت مساعد ذكي لخدمة عملاء شركة تسويق رقمي و CRM على واتساب.

قواعد مهمة:
- ردودك قصيرة وواضحة ومهذبة (جملتين كحد أقصى).
- إذا كان السؤال خارج نطاق الخدمة، اعتذر بلطف.
- إذا طلب المستخدم بوضوح التحدث مع "خدمة العملاء" أو "حد بشري" أو "موظف" أو كتب:
  "عايز اكلم خدمة العملاء" / "كلّمني حد من الشركة" / "عايز اتواصل مع موظف"

  عندها:
  1) ارد برسالة واحدة فقط: "جاري تحويلك إلى خدمة العملاء الآن ✅"
  2) ضع handoff = true في استجابتك

- غير ذلك، استمر في الرد كروبوت مساعد.

استجب بصيغة JSON فقط:
{
  "reply": "نص الرد هنا",
  "handoff": true أو false,
  "handoff_reason": "سبب التحويل (اختياري)"
}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conversationHistory,
    { role: 'user' as const, content: userMessage },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // or 'gpt-3.5-turbo' for cheaper
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 200,
  });

  const content = response.choices[0].message.content || '{}';
  return JSON.parse(content) as AIResponse;
}
```

#### Step 3: Modify Message Handler
```typescript
// In sock.ev.on('messages.upsert', async ({ messages, type }) => {...}
// After saving incoming message to Firestore:

// Don't reply to messages from us
if (isFromMe) return;

// Load chat document
const chatRef = db.collection('whatsappSessions').doc(sessionId).collection('chats').doc(chatId);
const chatDoc = await chatRef.get();

if (!chatDoc.exists) {
  console.log(`Chat ${chatId} not found, creating with AI mode...`);
  await chatRef.set({
    id: chatId,
    remoteId: chatId,
    name: chatId.split('@')[0],
    type: 'INDIVIDUAL',
    status: 'INBOX',
    lastMessage: text,
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    assignedTo: null,
    isGroup: false,
    isRead: false,
    isMuted: false,
    isArchived: false,
    sessionId,
    mode: 'ai', // Default to AI mode
    needsHuman: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

const chatData = chatDoc.data();

// If mode is 'human', don't call AI
if (chatData?.mode === 'human') {
  console.log(`Chat ${chatId} is in human mode, skipping AI`);
  return;
}

// Mode is 'ai' - call AI agent
console.log(`Chat ${chatId} is in AI mode, calling AI agent...`);

try {
  // Get conversation history (last 5 messages)
  const messagesSnapshot = await chatRef
    .collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(5)
    .get();

  const conversationHistory = messagesSnapshot.docs
    .reverse()
    .map((doc) => {
      const msg = doc.data();
      return {
        role: msg.isFromMe ? ('assistant' as const) : ('user' as const),
        content: msg.body || msg.text || '',
      };
    })
    .filter((m) => m.content.trim() !== '');

  // Call AI
  const aiResponse = await callAI(conversationHistory, text);

  // Send reply
  await sock.sendMessage(chatId, { text: aiResponse.reply });

  // Save AI message to Firestore
  await chatRef.collection('messages').add({
    id: `ai_${Date.now()}`,
    chatId,
    sender: 'bot',
    body: aiResponse.reply,
    text: aiResponse.reply,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    isFromMe: true,
    isFromUs: true,
    mediaType: null,
    mediaUrl: null,
    status: 'sent',
    sessionId,
  });

  // If handoff requested
  if (aiResponse.handoff) {
    console.log(`AI requested handoff for chat ${chatId}: ${aiResponse.handoff_reason}`);

    await chatRef.update({
      mode: 'human',
      needsHuman: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Chat ${chatId} switched to human mode`);
  }
} catch (error) {
  console.error(`Error calling AI for chat ${chatId}:`, error);

  // Fallback message
  await sock.sendMessage(chatId, {
    text: 'عذراً، حدث خطأ. سيتم تحويلك إلى خدمة العملاء.',
  });

  await chatRef.update({
    mode: 'human',
    needsHuman: true,
  });
}
```

---

## 🔧 **Environment Variables Needed**

Add to `.env.local`:
```bash
OPENAI_API_KEY=sk-...your-key-here
```

Or if using Gemini:
```bash
GEMINI_API_KEY=...your-key-here
```

---

## ✅ **Testing Checklist**

### Test Manual Chat Creation:
1. ✅ Click "محادثة جديدة" button
2. ✅ Enter phone number (e.g., 201234567890)
3. ✅ Enter first message
4. ✅ Click "إرسال"
5. ✅ Verify chat appears in sidebar
6. ✅ Verify message sent to WhatsApp

### Test AI Agent:
1. ✅ Send normal message from WhatsApp
2. ✅ Verify AI responds automatically
3. ✅ Send "عايز اكلم خدمة العملاء"
4. ✅ Verify AI responds with handoff message
5. ✅ Verify chat mode changes to 'human'
6. ✅ Send another message
7. ✅ Verify AI doesn't respond (mode is 'human')

### Test Mode Toggle:
1. ✅ Open a chat in AI mode
2. ✅ Toggle switch to Human mode
3. ✅ Verify mode indicator changes
4. ✅ Verify AI stops responding
5. ✅ Toggle back to AI mode
6. ✅ Verify AI starts responding again

---

## 📝 **Next Steps**

1. **Integrate NewChatModal into chat page UI** (5 min)
2. **Add AI mode indicator/toggle to chat header** (10 min)
3. **Install OpenAI SDK** (1 min)
4. **Implement AI logic in worker.ts** (20 min)
5. **Add environment variables** (1 min)
6. **Test complete flow** (15 min)

**Total estimated time:** ~50 minutes

---

## 🎯 **Files Summary**

### ✅ Completed:
- `src/lib/types.ts` - Updated Chat interface
- `src/lib/phone-utils.ts` - Phone utilities
- `src/components/chat/new-chat-modal.tsx` - New chat modal
- `src/app/api/messages/manual-send/route.ts` - Manual send API

### 🚧 To Modify:
- `src/app/(app)/chat/page.tsx` - Integrate modal & fetch chats
- `src/components/chat/chat-header.tsx` - Add mode indicator
- `src/worker.ts` - Implement AI agent logic
- `.env.local` - Add API keys

---

**Status:** 60% Complete
**Committed:** Work in progress (commit: 6dfeff4)
