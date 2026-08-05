import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration } from '@google/generative-ai';
import { env } from '../env';
import { AppError } from './errors';

/**
 * Per-organization Gemini client — separate from the global GEMINI_API_KEY
 * used by Phase 1's package-description generator (src/modules/ai). Each
 * org supplies its OWN key (Settings → AI Agent), encrypted at rest, so this
 * module always takes the key as a parameter rather than reading env.
 */

function client(apiKey: string): GoogleGenerativeAI {
  return new GoogleGenerativeAI(apiKey);
}

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
      `Extract any travel-enquiry details from this traveller message. Call extract_lead_fields with only the fields they actually mentioned.\n\nMessage: "${message}"`,
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

export const DEFAULT_GEMINI_MODEL = env.GEMINI_MODEL;
