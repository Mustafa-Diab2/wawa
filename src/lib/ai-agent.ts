import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Determine which AI provider to use based on available API keys
const AI_PROVIDER = process.env.GEMINI_API_KEY ? 'gemini' : 'openai';

// Initialize OpenAI client (if using OpenAI)
const openai = AI_PROVIDER === 'openai' ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
}) : null;

// Initialize Gemini client (if using Gemini)
const genAI = AI_PROVIDER === 'gemini' ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '') : null;

export interface AIResponse {
  reply: string;
  handoff: boolean;
  handoff_reason?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `أنت مساعد ذكي لخدمة عملاء شركة تسويق رقمي و CRM على واتساب.

قواعد مهمة:
- ردودك قصيرة وواضحة ومهذبة (جملتين كحد أقصى).
- لا تكتب فقرات طويلة.
- إذا كان السؤال خارج نطاق الخدمة، اعتذر بلطف واطلب من العميل أن يوضح ما يحتاجه.
- إذا طلب المستخدم بوضوح التحدث مع "خدمة العملاء" أو "حد بشري" أو "موظف" أو كتب عبارات مثل:
  * "عايز اكلم خدمة العملاء"
  * "كلّمني حد من الشركة"
  * "عايز اتواصل مع موظف"
  * "ممكن اكلم حد"
  * "محتاج مساعدة من موظف"

  عندها يجب عليك:
  1) أن ترد برسالة واحدة فقط: "جاري تحويلك إلى خدمة العملاء الآن ✅ سيتواصل معك أحد ممثلينا في أقرب وقت."
  2) ثم تضع علامة handoff = true في استجابتك (للاستخدام البرمجي).

- غير ذلك، استمر في الرد كروبوت مساعد محترف ومفيد.

**مهم جداً:** استجب فقط بصيغة JSON الصحيحة بدون أي نص إضافي:
{
  "reply": "نص الرد هنا",
  "handoff": true أو false,
  "handoff_reason": "سبب التحويل (اختياري)"
}`;

/**
 * Call AI agent using Gemini
 */
async function callGemini(
  conversationHistory: ConversationMessage[],
  userMessage: string
): Promise<AIResponse> {
  if (!genAI) {
    throw new Error('Gemini not initialized');
  }

  console.log('[AI Agent] Using Gemini with', conversationHistory.length, 'history messages');

  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 200,
      responseMimeType: 'application/json',
    },
  });

  // Build conversation history for Gemini
  const conversationText = conversationHistory
    .map(msg => `${msg.role === 'user' ? 'المستخدم' : 'المساعد'}: ${msg.content}`)
    .join('\n');

  const prompt = `${SYSTEM_PROMPT}

المحادثة السابقة:
${conversationText}

المستخدم: ${userMessage}

استجب بصيغة JSON فقط:`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const content = response.text();

  console.log('[AI Agent] Gemini raw response:', content);

  // Parse JSON response
  const aiResponse = JSON.parse(content) as AIResponse;

  if (!aiResponse.reply) {
    throw new Error('Invalid AI response: missing reply field');
  }

  console.log('[AI Agent] Gemini parsed response:', {
    replyLength: aiResponse.reply.length,
    handoff: aiResponse.handoff,
    reason: aiResponse.handoff_reason,
  });

  return aiResponse;
}

/**
 * Call AI agent using OpenAI
 */
async function callOpenAI(
  conversationHistory: ConversationMessage[],
  userMessage: string
): Promise<AIResponse> {
  if (!openai) {
    throw new Error('OpenAI not initialized');
  }

  console.log('[AI Agent] Using OpenAI with', conversationHistory.length, 'history messages');

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 200,
  });

  const content = response.choices[0].message.content || '{}';
  console.log('[AI Agent] OpenAI raw response:', content);

  const aiResponse = JSON.parse(content) as AIResponse;

  if (!aiResponse.reply) {
    throw new Error('Invalid AI response: missing reply field');
  }

  console.log('[AI Agent] OpenAI parsed response:', {
    replyLength: aiResponse.reply.length,
    handoff: aiResponse.handoff,
    reason: aiResponse.handoff_reason,
  });

  return aiResponse;
}

/**
 * Call AI agent to generate response (supports both OpenAI and Gemini)
 * @param conversationHistory - Array of previous messages
 * @param userMessage - The latest user message
 * @returns AI response with handoff flag
 */
export async function callAI(
  conversationHistory: ConversationMessage[],
  userMessage: string
): Promise<AIResponse> {
  // Check if any API key is configured
  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    console.error('[AI Agent] No AI API key configured (tried OpenAI and Gemini)');
    return {
      reply: 'عذراً، النظام الآلي غير متاح حالياً. سيتم تحويلك إلى خدمة العملاء.',
      handoff: true,
      handoff_reason: 'AI not configured',
    };
  }

  try {
    // Call appropriate AI provider
    if (AI_PROVIDER === 'gemini') {
      return await callGemini(conversationHistory, userMessage);
    } else {
      return await callOpenAI(conversationHistory, userMessage);
    }
  } catch (error: any) {
    console.error(`[AI Agent] Error calling ${AI_PROVIDER}:`, error);

    // Fallback response
    return {
      reply: 'عذراً، حدث خطأ في النظام. سيتم تحويلك إلى خدمة العملاء للمساعدة.',
      handoff: true,
      handoff_reason: `AI error: ${error.message}`,
    };
  }
}

/**
 * Check if message content indicates urgent need for human
 * This is a fast pre-check before calling AI
 */
export function isUrgentHandoffRequest(message: string): boolean {
  const urgentKeywords = [
    'عاجل',
    'مستعجل',
    'ضروري',
    'طوارئ',
    'شكوى',
    'مشكلة كبيرة',
    'urgent',
    'emergency',
  ];

  const lowerMessage = message.toLowerCase();
  return urgentKeywords.some((keyword) => lowerMessage.includes(keyword));
}
