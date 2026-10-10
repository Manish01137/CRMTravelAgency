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

/**
 * Thinking (the model's hidden reasoning) is billed as output and was ~90% of
 * the cost of the bot's small tasks — reading an answer, yes/no, picking a
 * package — with the same result without it (measured). `fast` turns it off
 * (thinkingBudget 0); a model that doesn't accept that (e.g. flash-lite, which
 * doesn't think by default) is asked again without it.
 */
const MINIMAL_THINKING = { thinkingConfig: { thinkingBudget: 0 } };
const isThinkingConfigRejected = (err: unknown) =>
  err instanceof Error && /\[400\b/.test(err.message) && /invalid argument|thinking/i.test(err.message);

/** Same shape as the SDK's client, but generateContent falls back across models. */
export function geminiClient(apiKey: string) {
  const ai = new GoogleGenerativeAI(apiKey);
  return {
    getGenerativeModel(params: ModelParams & { fast?: boolean }) {
      const { fast, ...modelParams } = params;
      return {
        async generateContent(request: Parameters<GenerativeModel['generateContent']>[0]) {
          const models = [modelParams.model, ...FALLBACK_MODELS.filter((m) => m !== modelParams.model)];
          let lastError: unknown;
          for (const model of models) {
            try {
              if (fast) {
                // The SDK passes generationConfig through as-is; its types just predate thinkingConfig.
                const generationConfig = { ...modelParams.generationConfig, ...MINIMAL_THINKING } as ModelParams['generationConfig'];
                try {
                  return await ai.getGenerativeModel({ ...modelParams, model, generationConfig }).generateContent(request);
                } catch (err) {
                  if (!isThinkingConfigRejected(err)) throw err;
                }
              }
              return await ai.getGenerativeModel({ ...modelParams, model }).generateContent(request);
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
      fast: true,
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
      fast: true,
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
      fast: true,
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

// --- Bot Flow: AI follow-up after a flow has finished -----------------------

export interface CatalogPackage {
  id: string;
  name: string;
  destination: string;
  days: number;
  nights: number;
  price: string;
  /** Full details — only for the packages the conversation is about; the rest are one line each. */
  summary?: string;
}

export interface FollowUpResult {
  /** package: they want a trip/package · question: about a trip, price, booking · other: thanks / ok / small talk */
  intent: 'package' | 'question' | 'other';
  /** Catalogue ids that fit what they asked for (only ids from the catalogue). */
  packageIds: string[];
  /** Message to send now — empty for "other". */
  reply: string;
  /** True when a person on the team needs to take over (no fitting package, can't answer from the facts). */
  handoff: boolean;
  lead: { name?: string; destination?: string; travelDate?: string; travelerCount?: number; email?: string };
}

/**
 * After a Bot Flow has finished, reads the traveller's new message against the
 * agency's own package catalogue: picks matching packages, writes a short
 * reply grounded ONLY in the catalogue and agency facts, and flags when a
 * person should take over. Never invents packages, prices or inclusions.
 */
export async function runFollowUpAssistant(
  apiKey: string,
  model: string,
  persona: { systemPrompt: string | null; agencyFacts: string | null; tone: string | null },
  catalog: CatalogPackage[],
  history: ConversationTurn[],
  latestMessage: string,
): Promise<FollowUpResult> {
  return fail(async () => {
    const genModel = client(apiKey).getGenerativeModel({
      model,
      fast: true,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    });
    const transcript = history
      .slice(-12)
      .map((t) => `${t.direction === 'INBOUND' ? 'Traveller' : 'Agency'}: ${t.body.slice(0, 400)}`)
      .join('\n');
    const catalogText = catalog.length
      ? catalog.map((p) => `- ${p.id} | ${p.name} | ${p.destination} | ${p.days}D/${p.nights}N | ${p.price}${p.summary ? ` | ${p.summary}` : ''}`).join('\n')
      : '(no packages)';
    const prompt = `${personaPreamble(persona.systemPrompt, persona.agencyFacts, persona.tone)}

You are the agency's WhatsApp/Instagram assistant. Today is ${new Date().toISOString().slice(0, 10)}.
The agency's packages (the ONLY trips you may offer; the first value is the package id — some lines include details, the rest are one-line summaries, and you may only state inclusions/details that are written here):
${catalogText}

Recent conversation:
${transcript || '(none)'}
Traveller: ${latestMessage}

Decide what the traveller wants and return ONLY JSON:
{"intent": "package" | "question" | "other",
 "packageIds": ["ids from the list above that fit, best first, at most 5"],
 "reply": "short friendly message to send now, plain text, 1-3 sentences, same language as the traveller",
 "handoff": true or false,
 "lead": {"name": "", "destination": "", "travelDate": "YYYY-MM-DD", "travelerCount": 0, "email": ""}}

Rules:
- Decide from the traveller's LATEST message only; earlier messages are just context. "Thanks", "ok", "great" after packages were sent is intent "other" — never send the same packages again unless they ask again.
- intent "package": they want a trip, package, itinerary or prices for a place or kind of trip. Put the fitting package ids in packageIds — match by destination or name, and use your general knowledge of places for themes (desert → Jaisalmer, beach → Goa/Andaman, snow → Manali/Kashmir, honeymoon, hills, pilgrimage…), also nearby/obvious matches (e.g. Kasol for Manali only if the package mentions it). The packages are sent right after your reply, so the reply just introduces them (e.g. "Here's our Manali package for your group of 4 👇") — don't repeat prices or details.
- If nothing in the list fits, packageIds is [], the reply apologises that there's no ready package for that place right now and says the team will get back to them shortly, and handoff is true.
- intent "question": answer ONLY from the package details and agency facts above. If the answer isn't there, say the team will confirm shortly and set handoff true. Never invent prices, dates, inclusions or availability.
- intent "other": thanks, ok, emojis, small talk — reply is "" and handoff false.
- lead: only details the traveller actually stated; leave others empty. A date without a year means its next occurrence from today.`;
    const result = await genModel.generateContent(prompt);
    const raw = result.response.text();
    let parsed: Partial<FollowUpResult> & { lead?: Record<string, unknown> };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : {};
    }
    const known = new Set(catalog.map((p) => p.id));
    const lead = (parsed.lead ?? {}) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const count = Number(lead.travelerCount);
    return {
      intent: parsed.intent === 'package' || parsed.intent === 'question' ? parsed.intent : 'other',
      packageIds: (Array.isArray(parsed.packageIds) ? parsed.packageIds : []).filter((id): id is string => typeof id === 'string' && known.has(id)).slice(0, 5),
      reply: typeof parsed.reply === 'string' ? parsed.reply.trim().slice(0, 1000) : '',
      handoff: !!parsed.handoff,
      lead: {
        name: str(lead.name),
        destination: str(lead.destination),
        travelDate: str(lead.travelDate),
        travelerCount: Number.isFinite(count) && count > 0 ? Math.round(count) : undefined,
        email: str(lead.email),
      },
    };
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
      fast: true,
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
