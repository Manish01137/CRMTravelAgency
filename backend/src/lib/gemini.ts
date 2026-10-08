import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration, type GenerativeModel, type ModelParams } from '@google/generative-ai';
import { env } from '../env';
import { AppError } from './errors';

/**
 * Gemini helpers for the AI features. Callers pass the key in (from
 * loadAgentContext, i.e. the server's GEMINI_API_KEY) rather than this
 * module reading env directly.
 */

/**
 * Models tried, in order, after the configured one. Google retires models for
 * new keys (2.5-flash was) and a model can be briefly overloaded (503) — the
 * bot should carry on with the next model instead of going quiet.
 */
const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash'];

/** Model-specific failures worth retrying on another model: retired / unknown, overloaded, rate-limited. */
function isModelUnavailable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /\[(404|429|500|503)\b|not found|no longer available|high demand|overloaded|unavailable/i.test(message);
}

/** Same shape as the SDK's client, but generateContent falls back across models. */
export function geminiClient(apiKey: string) {
  const ai = new GoogleGenerativeAI(apiKey);
  return {
    getGenerativeModel(params: ModelParams) {
      return {
        async generateContent(request: Parameters<GenerativeModel['generateContent']>[0]) {
          const models = [params.model, ...FALLBACK_MODELS.filter((m) => m !== params.model)];
          let lastError: unknown;
          for (const model of models) {
            try {
              return await ai.getGenerativeModel({ ...params, model }).generateContent(request);
            } catch (err) {
              lastError = err;
              if (!isModelUnavailable(err)) throw err;
              console.warn(`[gemini] ${model} unavailable, trying the next model:`, err instanceof Error ? err.message.slice(0, 160) : err);
            }
          }
          throw lastError;
        },
      };
    },
  };
}

const client = geminiClient;

async function fail<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    throw new AppError(502, 'AI_FAILED', 'The AI service could not complete the request. Try again.');
  }
}

// --- Structured field extraction (function calling) -------------------------

export interface ExtractedLeadFields {
  destination?: string;
  travelDate?: string; // ISO date (YYYY-MM-DD)
  travelerCount?: number;
  name?: string;
  email?: string;
  phone?: string;
  budgetAmount?: number;
  notes?: string;
}

const extractLeadFieldsDeclaration: FunctionDeclaration = {
  name: 'extract_lead_fields',
  description: "Extract any travel-enquiry details the traveller mentioned. Omit fields they didn't mention — never guess.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      destination: { type: SchemaType.STRING, description: 'Where they want to travel to' },
      travelDate: { type: SchemaType.STRING, description: 'Intended travel date, ISO format YYYY-MM-DD if a specific date is given' },
      travelerCount: { type: SchemaType.NUMBER, description: 'Number of travellers / pax' },
      name: { type: SchemaType.STRING, description: "The traveller's own name, if they gave it" },
      email: { type: SchemaType.STRING, description: 'Email address, if given' },
      phone: { type: SchemaType.STRING, description: 'Phone number, if given' },
      budgetAmount: { type: SchemaType.NUMBER, description: 'Budget amount mentioned (whole number, currency-agnostic)' },
      notes: { type: SchemaType.STRING, description: 'Any other relevant detail worth noting on the lead' },
    },
  },
};

/**
 * Runs Gemini function-calling against one free-text message to pull out
 * structured Lead fields. Feeds Bot Flow's COLLECT steps so the bot can
 * understand natural language, not just rigid button taps. Returns {} (never
 * throws for "nothing found") when the model extracts nothing.
 */
export async function extractLeadFields(apiKey: string, model: string, message: string): Promise<ExtractedLeadFields> {
  return fail(async () => {
    const genModel = client(apiKey).getGenerativeModel({
      model,
      tools: [{ functionDeclarations: [extractLeadFieldsDeclaration] }],
    });
    const result = await genModel.generateContent(
      `Extract any travel-enquiry details from this traveller message. Call extract_lead_fields with only the fields they actually mentioned.\n` +
        // The model doesn't know today's date — without this, "25 December" came back as a past year.
        `Today is ${new Date().toISOString().slice(0, 10)}. A travel date without a year means its next occurrence from today.\n\nMessage: "${message}"`,
    );
    const calls = result.response.functionCalls();
    const call = calls?.find((c) => c.name === 'extract_lead_fields');
    if (!call) return {};
    return (call.args ?? {}) as ExtractedLeadFields;
  });
}

// --- Reply drafting (Suggest Reply) ------------------------------------------

export interface ConversationTurn {
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
}

function personaPreamble(systemPrompt: string | null, agencyFacts: string | null, tone: string | null): string {
  return [
    `You are a helpful travel-agency assistant.`,
    tone && `Tone: ${tone}.`,
    systemPrompt && `Persona/instructions: ${systemPrompt}`,
    agencyFacts && `Key facts about the agency: ${agencyFacts}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Drafts ONE reply for a human agent to review/edit/send — never auto-sent. */
export async function suggestReply(
  apiKey: string,
  model: string,
  persona: { systemPrompt: string | null; agencyFacts: string | null; tone: string | null },
  history: ConversationTurn[],
): Promise<string> {
  return fail(async () => {
    const genModel = client(apiKey).getGenerativeModel({ model, generationConfig: { temperature: 0.6 } });
    const transcript = history
      .slice(-20)
      .map((t) => `${t.direction === 'INBOUND' ? 'Traveller' : 'Agent'}: ${t.body}`)
      .join('\n');
    const prompt = `${personaPreamble(persona.systemPrompt, persona.agencyFacts, persona.tone)}

Below is a conversation with a traveller. Draft the agent's NEXT reply — natural, concise, plain text (no markdown), ready to send as-is or lightly edited by a human agent.

${transcript}

Agent:`;
    const result = await genModel.generateContent(prompt);
    return result.response.text().trim();
  });
}

/** Summarizes a (possibly long) lead thread into a short handoff-ready paragraph. */
export async function summarizeConversation(apiKey: string, model: string, history: ConversationTurn[]): Promise<string> {
  return fail(async () => {
    const genModel = client(apiKey).getGenerativeModel({ model, generationConfig: { temperature: 0.3 } });
    const transcript = history.map((t) => `${t.direction === 'INBOUND' ? 'Traveller' : 'Agent'}: ${t.body}`).join('\n');
    const prompt = `Summarize this traveller conversation in 3-5 sentences for a human agent picking it up: what they want, key details already given (destination/dates/pax/budget), and what's still outstanding.\n\n${transcript}`;
    const result = await genModel.generateContent(prompt);
    return result.response.text().trim();
  });
}

// --- Bot Flow: keyword-free natural-language CONFIRM matching (yes/no) ------

/** Best-effort yes/no classification for a CONFIRM step reply. Falls back to null (fallback message) when ambiguous. */
export async function classifyYesNo(apiKey: string, model: string, question: string, reply: string): Promise<'yes' | 'no' | null> {
  return fail(async () => {
    const genModel = client(apiKey).getGenerativeModel({
      model,
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    });
    const prompt = `Question asked: "${question}"\nTraveller's reply: "${reply}"\n\nDoes the reply mean yes or no? Return ONLY JSON: {"answer": "yes" | "no" | "unclear"}`;
    const result = await genModel.generateContent(prompt);
    const raw = result.response.text();
    try {
      const parsed = JSON.parse(raw) as { answer?: string };
      return parsed.answer === 'yes' ? 'yes' : parsed.answer === 'no' ? 'no' : null;
    } catch {
      return null;
    }
  });
}

// --- Bot Flow: AI_OPEN step — free-form conversation with its own exit condition ---

export interface OpenStepResult {
  reply: string;
  shouldAdvance: boolean;
  notes?: string;
}

/**
 * Bot Flow's AI_OPEN step: the AI Agent persona converses freely, guided by
 * this one step's own `instructions` (e.g. "Answer questions about our Bali
 * packages; once they mention a budget, wrap up"), deciding turn-by-turn
 * whether to keep going or let the flow move on to nextStepId.
 */
export async function runOpenStep(
  apiKey: string,
  model: string,
  persona: { systemPrompt: string | null; agencyFacts: string | null; tone: string | null },
  instructions: string,
  history: ConversationTurn[],
  latestMessage: string,
): Promise<OpenStepResult> {
  return fail(async () => {
    const genModel = client(apiKey).getGenerativeModel({
      model,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
    });
    const transcript = history
      .slice(-20)
      .map((t) => `${t.direction === 'INBOUND' ? 'Traveller' : 'Agent'}: ${t.body}`)
      .join('\n');
    const prompt = `${personaPreamble(persona.systemPrompt, persona.agencyFacts, persona.tone)}

For this part of the conversation, follow these instructions: ${instructions}

Conversation so far:
${transcript}
Traveller: ${latestMessage}

Reply naturally as the agent (plain text, no markdown), then decide whether this part of the conversation is done and the flow should move on. Return ONLY JSON:
{"reply": "your reply to send now", "shouldAdvance": true or false, "notes": "anything worth saving to the lead's notes, or an empty string"}`;
    const result = await genModel.generateContent(prompt);
    const raw = result.response.text();
    try {
      const parsed = JSON.parse(raw) as { reply?: string; shouldAdvance?: boolean; notes?: string };
      return {
        reply: parsed.reply?.trim() || "Got it, thanks!",
        shouldAdvance: !!parsed.shouldAdvance,
        notes: parsed.notes?.trim() || undefined,
      };
    } catch {
      return { reply: "Got it, thanks!", shouldAdvance: false };
    }
  });
}

// --- Smart Bot: tool routing (function calling) ------------------------------

export interface BotToolCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Smart Bot's ONLY use of Gemini: given a free-text WhatsApp message and a
 * fixed set of tool declarations, picks AT MOST one tool and extracts its
 * arguments. Deliberately returns just {name, args} — never reply text.
 * Gemini's job stops at routing + extraction; the caller (smart-bot.service.ts)
 * executes the matched tool deterministically against real CRM data and sends
 * whatever THAT produces. Returns null when nothing matches confidently —
 * the caller falls back to a "would you like to speak with an agent?" message.
 */
export async function classifyBotIntent(
  apiKey: string,
  model: string,
  message: string,
  packageNames: string[],
  toolDeclarations: FunctionDeclaration[],
): Promise<BotToolCall | null> {
  return fail(async () => {
    const genModel = client(apiKey).getGenerativeModel({
      model,
      tools: [{ functionDeclarations: toolDeclarations }],
    });
    const context = packageNames.length
      ? `\n\nThis agency's active packages (for matching a mentioned destination): ${packageNames.join(', ')}`
      : '';
    const result = await genModel.generateContent(
      `A traveller sent this WhatsApp message to a travel agency: "${message}"${context}\n\n` +
        `If it clearly matches one of the available tools, call it with the best-extracted arguments. ` +
        `If nothing fits confidently, do not call any function.`,
    );
    const call = result.response.functionCalls()?.[0];
    if (!call) return null;
    return { name: call.name, args: (call.args ?? {}) as Record<string, unknown> };
  });
}

export const DEFAULT_GEMINI_MODEL = env.GEMINI_MODEL;
