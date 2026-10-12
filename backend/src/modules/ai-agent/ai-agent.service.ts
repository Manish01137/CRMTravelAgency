import { withTenant } from '../../lib/prisma';
import { env } from '../../env';
import { suggestReply as geminiSuggestReply, summarizeConversation as geminiSummarize, DEFAULT_GEMINI_MODEL } from '../../lib/gemini';
import { BadRequest, NotFound } from '../../lib/errors';
import type { UpdateSettingsInput } from './ai-agent.schemas';

// The Gemini key is platform-level (backend GEMINI_API_KEY only) — orgs never
// supply their own. Each org still owns its persona: prompt, facts, tone.
// AiAgentSettings.geminiApiKey is left in the schema but no longer read or
// written.

export interface AiAgentSettingsView {
  systemPrompt: string | null;
  agencyFacts: string | null;
  tone: string | null;
  /** Whether AI is available at all, i.e. the server has a key configured. */
  aiEnabled: boolean;
  updatedAt: Date | null;
}

function toView(row: { systemPrompt: string | null; agencyFacts: string | null; tone: string | null; updatedAt: Date } | null): AiAgentSettingsView {
  return {
    systemPrompt: row?.systemPrompt ?? null,
    agencyFacts: row?.agencyFacts ?? null,
    tone: row?.tone ?? null,
    aiEnabled: !!env.GEMINI_API_KEY,
    updatedAt: row?.updatedAt ?? null,
  };
}

export async function getSettings(organizationId: string): Promise<AiAgentSettingsView> {
  return withTenant(organizationId, async (tx) => {
    const row = await tx.aiAgentSettings.findUnique({ where: { organizationId } });
    return toView(row);
  });
}

export async function updateSettings(organizationId: string, input: UpdateSettingsInput): Promise<AiAgentSettingsView> {
  const data = {
    ...(input.systemPrompt !== undefined && { systemPrompt: input.systemPrompt }),
    ...(input.agencyFacts !== undefined && { agencyFacts: input.agencyFacts }),
    ...(input.tone !== undefined && { tone: input.tone }),
  };
  const row = await withTenant(organizationId, (tx) =>
    tx.aiAgentSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    }),
  );
  personaCache.delete(organizationId);
  return toView(row);
}

/** The org's AI persona, kept in memory for a minute (cleared on save) — the bot asks for it on every message. */
const PERSONA_TTL_MS = 60_000;
const personaCache = new Map<string, { value: { systemPrompt: string | null; agencyFacts: string | null; tone: string | null }; expires: number }>();

/** The server's Gemini key + this org's persona — used by every AI feature
 *  (Bot Flow, Smart Bot, Suggest Reply, Summarize). Null when the server has
 *  no key, which each caller already treats as "AI unavailable". */
export async function loadAgentContext(organizationId: string): Promise<{
  apiKey: string;
  systemPrompt: string | null;
  agencyFacts: string | null;
  tone: string | null;
} | null> {
  if (!env.GEMINI_API_KEY) return null;
  const apiKey = env.GEMINI_API_KEY;
  const hit = personaCache.get(organizationId);
  if (hit && hit.expires > Date.now()) return { apiKey, ...hit.value };
  const row = await withTenant(organizationId, (tx) => tx.aiAgentSettings.findUnique({ where: { organizationId } }));
  const value = { systemPrompt: row?.systemPrompt ?? null, agencyFacts: row?.agencyFacts ?? null, tone: row?.tone ?? null };
  personaCache.set(organizationId, { value, expires: Date.now() + PERSONA_TTL_MS });
  return { apiKey, ...value };
}

/** Loads the last N turns of a conversation directly (same Prisma tables Phase
 *  3's Inbox uses) — not importing inbox.service, matching the established
 *  cross-module pattern (Communications reads Lead directly, same idea). */
async function loadConversationTurns(organizationId: string, conversationId: string) {
  return withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw NotFound('Conversation not found');
    const messages = await tx.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return messages
      .reverse()
      .filter((m) => m.body)
      .map((m) => ({ direction: m.direction, body: m.body as string }));
  });
}

export async function suggestReplyForConversation(organizationId: string, conversationId: string): Promise<string> {
  const agent = await loadAgentContext(organizationId);
  if (!agent) throw BadRequest('AI is not enabled on this server yet — contact your administrator');
  const turns = await loadConversationTurns(organizationId, conversationId);
  if (turns.length === 0) throw BadRequest('This conversation has no messages yet');
  return geminiSuggestReply(agent.apiKey, DEFAULT_GEMINI_MODEL, agent, turns);
}

export async function summarizeConversationById(organizationId: string, conversationId: string): Promise<string> {
  const agent = await loadAgentContext(organizationId);
  if (!agent) throw BadRequest('AI is not enabled on this server yet — contact your administrator');
  const turns = await loadConversationTurns(organizationId, conversationId);
  if (turns.length === 0) throw BadRequest('This conversation has no messages yet');
  return geminiSummarize(agent.apiKey, DEFAULT_GEMINI_MODEL, turns);
}
