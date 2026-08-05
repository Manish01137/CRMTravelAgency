import { withTenant } from '../../lib/prisma';
import { encrypt, decrypt, isEncryptionConfigured } from '../../lib/encryption';
import { suggestReply as geminiSuggestReply, summarizeConversation as geminiSummarize, DEFAULT_GEMINI_MODEL } from '../../lib/gemini';
import { AppError, BadRequest, NotFound } from '../../lib/errors';
import type { UpdateSettingsInput } from './ai-agent.schemas';

export interface AiAgentSettingsView {
  systemPrompt: string | null;
  agencyFacts: string | null;
  tone: string | null;
  hasGeminiKey: boolean;
  updatedAt: Date | null;
}

function toView(row: { systemPrompt: string | null; agencyFacts: string | null; tone: string | null; geminiApiKey: string | null; updatedAt: Date } | null): AiAgentSettingsView {
  return {
    systemPrompt: row?.systemPrompt ?? null,
    agencyFacts: row?.agencyFacts ?? null,
    tone: row?.tone ?? null,
    hasGeminiKey: !!row?.geminiApiKey,
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
  if (input.geminiApiKey && !isEncryptionConfigured()) {
    throw new AppError(503, 'ENCRYPTION_NOT_CONFIGURED', 'The server is not configured to store API keys yet — contact your administrator');
  }
  const data = {
    ...(input.systemPrompt !== undefined && { systemPrompt: input.systemPrompt }),
    ...(input.agencyFacts !== undefined && { agencyFacts: input.agencyFacts }),
    ...(input.tone !== undefined && { tone: input.tone }),
    ...(input.geminiApiKey !== undefined && { geminiApiKey: encrypt(input.geminiApiKey) }),
  };
  const row = await withTenant(organizationId, (tx) =>
    tx.aiAgentSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    }),
  );
  return toView(row);
}

export async function clearGeminiKey(organizationId: string): Promise<AiAgentSettingsView> {
  const row = await withTenant(organizationId, (tx) =>
    tx.aiAgentSettings.upsert({
      where: { organizationId },
      create: { organizationId, geminiApiKey: null },
      update: { geminiApiKey: null },
    }),
  );
  return toView(row);
}

/** Loads + decrypts the org's persona + Gemini key together — used by both
 *  the HTTP endpoints below and Bot Flow's execution engine. */
export async function loadAgentContext(organizationId: string): Promise<{
  apiKey: string;
  systemPrompt: string | null;
  agencyFacts: string | null;
  tone: string | null;
} | null> {
  return withTenant(organizationId, async (tx) => {
    const row = await tx.aiAgentSettings.findUnique({ where: { organizationId } });
    if (!row?.geminiApiKey) return null;
    return { apiKey: decrypt(row.geminiApiKey), systemPrompt: row.systemPrompt, agencyFacts: row.agencyFacts, tone: row.tone };
  });
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
  if (!agent) throw BadRequest('Add a Gemini API key in Settings → AI Agent first');
  const turns = await loadConversationTurns(organizationId, conversationId);
  if (turns.length === 0) throw BadRequest('This conversation has no messages yet');
  return geminiSuggestReply(agent.apiKey, DEFAULT_GEMINI_MODEL, agent, turns);
}

export async function summarizeConversationById(organizationId: string, conversationId: string): Promise<string> {
  const agent = await loadAgentContext(organizationId);
  if (!agent) throw BadRequest('Add a Gemini API key in Settings → AI Agent first');
  const turns = await loadConversationTurns(organizationId, conversationId);
  if (turns.length === 0) throw BadRequest('This conversation has no messages yet');
  return geminiSummarize(agent.apiKey, DEFAULT_GEMINI_MODEL, turns);
}
