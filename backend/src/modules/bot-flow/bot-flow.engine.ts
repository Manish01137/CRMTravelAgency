import { withTenant } from '../../lib/prisma';
import { decryptJson } from '../../lib/encryption';
import { env } from '../../env';
import { sendWhatsAppText, sendInstagramText } from '../../lib/meta';
import { extractLeadFields, classifyYesNo, runOpenStep, DEFAULT_GEMINI_MODEL, type ConversationTurn } from '../../lib/gemini';
import { loadAgentContext } from '../ai-agent/ai-agent.service';
import type { WhatsAppCredentials, InstagramCredentials } from '../channels/channels.service';

/**
 * Bot Flow's execution engine — advances ONE conversation's BotFlowSession by
 * exactly one inbound message. Called by the poller (queues/bot-flow-poller.ts)
 * for every new inbound message on a bot-assigned conversation.
 *
 * Deliberately does NOT import inbox.service.ts's `sendMessage` (it requires a
 * human `userId`) — instead writes outbound Message rows directly via Prisma
 * and calls lib/meta.ts's send functions, the same low-level primitives
 * inbox.service.ts itself is built on. This keeps Phase 3's inbox module
 * completely untouched while reusing its exact send mechanics.
 *
 * IMPORTANT — every external call (Gemini, the WhatsApp/Instagram send) runs
 * OUTSIDE any `withTenant` transaction. Prisma's interactive transactions have
 * a short default timeout (5s); a slow or unreachable external API sitting
 * inside one doesn't just fail its own request, it kills the whole
 * transaction (found and fixed during Phase 4's own end-to-end testing — see
 * the load / decide / commit split below).
 *
 * Step types: COLLECT/CONFIRM/AI_OPEN are INTERACTIVE — the engine sends
 * their message and then stops, waiting for the traveller's next reply.
 * MESSAGE/SEND_PACKAGE are NON-interactive — they send and immediately
 * auto-chain to nextStepId in the same turn, no waiting, until an
 * interactive step (or CLOSING/HANDOFF) is reached. This lets a flow open
 * with a greeting + package share before its first real question without
 * the traveller needing to reply to each one individually.
 */

type StepType = 'COLLECT' | 'CONFIRM' | 'CLOSING' | 'MESSAGE' | 'HANDOFF' | 'SEND_PACKAGE' | 'AI_OPEN';
type ConfirmOption = { label: string; nextStepId: string | null };

interface StepRow {
  id: string;
  type: StepType;
  question: string | null;
  leadField: string | null;
  options: unknown;
  nextStepId: string | null;
  config: unknown;
}

interface LoadedState {
  conversation: { id: string; channel: 'WHATSAPP' | 'INSTAGRAM'; externalContactId: string; leadId: string | null };
  sessionId: string;
  sessionStatus: 'ACTIVE' | 'COMPLETED' | 'NEEDS_REVIEW';
  currentStepId: string | null;
  flowFallbackMessage: string;
  flowNeedsReviewKeywords: string[];
  steps: StepRow[];
}

type Action =
  | { kind: 'NEEDS_REVIEW'; reason: string }
  | { kind: 'REPEAT_FALLBACK' }
  | { kind: 'REPLY_AND_STAY'; reply: string }
  | { kind: 'ADVANCE'; leadField?: string; leadValue?: unknown; reply?: string; nextStep: StepRow | null };

const LEAD_DATE_FIELD = 'travelDate';
const LEAD_INT_FIELD = 'travelerCount';
const NON_INTERACTIVE_TYPES: StepType[] = ['MESSAGE', 'SEND_PACKAGE'];

function matchesKeyword(message: string, keywords: string[]): string | null {
  const lower = message.toLowerCase();
  return keywords.find((k) => lower.includes(k.toLowerCase())) ?? null;
}

/** Picks a flow's opening step: the one no other step's `nextStepId`/option points to. */
function findStartStep(steps: StepRow[]): StepRow | null {
  const referenced = new Set<string>();
  for (const s of steps) {
    if (s.nextStepId) referenced.add(s.nextStepId);
    if (Array.isArray(s.options)) {
      for (const opt of s.options as ConfirmOption[]) if (opt.nextStepId) referenced.add(opt.nextStepId);
    }
  }
  const roots = steps.filter((s) => !referenced.has(s.id));
  return (roots[0] ?? steps[0]) ?? null;
}

// --- Phase 1: load everything needed to decide, in one fast transaction -----

async function loadState(organizationId: string, conversationId: string): Promise<LoadedState | null> {
  return withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || (conversation.channel !== 'WHATSAPP' && conversation.channel !== 'INSTAGRAM')) return null;

    const assignment = await tx.botFlowAssignment.findUnique({
      where: { organizationId_channel: { organizationId, channel: conversation.channel } },
    });
    if (!assignment) return null; // no bot flow live on this org's connection for this channel

    // upsert, not findUnique-then-create: the scheduled poller (every 10s) and
    // a manually/concurrently triggered scan can both reach this for the same
    // brand-new conversation at once — a plain check-then-act loses that race
    // with a unique constraint violation (found during Phase 4's own testing).
    let session = await tx.botFlowSession.findUnique({ where: { conversationId } });
    if (!session) {
      session = await tx.botFlowSession.upsert({
        where: { conversationId },
        create: { organizationId, conversationId, flowId: assignment.flowId, status: 'ACTIVE' },
        update: {},
      });
    }
    if (session.status !== 'ACTIVE') return null; // NEEDS_REVIEW or COMPLETED — a human owns this thread now

    const flow = await tx.botFlow.findUnique({ where: { id: session.flowId }, include: { steps: { orderBy: { order: 'asc' } } } });
    if (!flow) return null;

    return {
      conversation: { id: conversation.id, channel: conversation.channel, externalContactId: conversation.externalContactId, leadId: conversation.leadId },
      sessionId: session.id,
      sessionStatus: session.status,
      currentStepId: session.currentStepId,
      flowFallbackMessage: flow.fallbackMessage,
      flowNeedsReviewKeywords: Array.isArray(flow.needsReviewKeywords) ? (flow.needsReviewKeywords as string[]) : [],
      steps: flow.steps as unknown as StepRow[],
    };
  });
}

/** Last 20 turns for AI_OPEN's conversational context — its own quick read, not held open across the Gemini call. */
async function loadRecentHistory(organizationId: string, conversationId: string): Promise<ConversationTurn[]> {
  return withTenant(organizationId, async (tx) => {
    const messages = await tx.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' }, take: 20 });
    return messages
      .reverse()
      .filter((m) => m.body)
      .map((m) => ({ direction: m.direction, body: m.body as string }));
  });
}

// --- Phase 2: decide what to do — pure logic + external calls, no open transaction ---

async function decide(state: LoadedState, messageBody: string, organizationId: string): Promise<Action> {
  const matched = matchesKeyword(messageBody, state.flowNeedsReviewKeywords);
  if (matched) return { kind: 'NEEDS_REVIEW', reason: `Matched "Needs Review" keyword: "${matched}"` };

  const agent = await loadAgentContext(organizationId).catch(() => null);
  const currentStep = state.currentStepId ? state.steps.find((s) => s.id === state.currentStepId) ?? null : null;

  if (!currentStep) {
    // Brand-new session: the inbound message just triggered the flow — open with the first step.
    return { kind: 'ADVANCE', nextStep: findStartStep(state.steps) };
  }

  if (currentStep.type === 'COLLECT') {
    let leadValue: unknown = messageBody.trim();
    if (currentStep.leadField && agent) {
      const extracted = await extractLeadFields(agent.apiKey, DEFAULT_GEMINI_MODEL, messageBody).catch(() => ({}));
      const field = currentStep.leadField as keyof typeof extracted;
      if (extracted[field] != null) leadValue = extracted[field];
    }
    const nextStep = currentStep.nextStepId ? state.steps.find((s) => s.id === currentStep.nextStepId) ?? null : null;
    return { kind: 'ADVANCE', leadField: currentStep.leadField ?? undefined, leadValue, nextStep };
  }

  if (currentStep.type === 'CONFIRM') {
    const options = (Array.isArray(currentStep.options) ? currentStep.options : []) as ConfirmOption[];
    const lower = messageBody.trim().toLowerCase();
    let matchedOption = options.find((o) => lower.includes(o.label.toLowerCase()) || o.label.toLowerCase().includes(lower));

    if (!matchedOption && options.length === 2 && agent) {
      const answer = await classifyYesNo(agent.apiKey, DEFAULT_GEMINI_MODEL, currentStep.question ?? '', messageBody).catch(() => null);
      if (answer) matchedOption = options.find((o) => o.label.toLowerCase().includes(answer)) ?? options[answer === 'yes' ? 0 : 1];
    }

    if (!matchedOption) return { kind: 'REPEAT_FALLBACK' };
    const nextStep = matchedOption.nextStepId ? state.steps.find((s) => s.id === matchedOption!.nextStepId) ?? null : null;
    return { kind: 'ADVANCE', nextStep };
  }

  if (currentStep.type === 'AI_OPEN') {
    if (!agent) return { kind: 'REPEAT_FALLBACK' }; // no AI Agent configured — can't run this step type
    const config = (currentStep.config ?? {}) as { instructions?: string };
    const history = await loadRecentHistory(organizationId, state.conversation.id);
    const result = await runOpenStep(agent.apiKey, DEFAULT_GEMINI_MODEL, agent, config.instructions ?? '', history, messageBody).catch(() => null);
    if (!result) return { kind: 'REPEAT_FALLBACK' };
    if (!result.shouldAdvance) return { kind: 'REPLY_AND_STAY', reply: result.reply };
    const nextStep = currentStep.nextStepId ? state.steps.find((s) => s.id === currentStep.nextStepId) ?? null : null;
    return { kind: 'ADVANCE', leadField: result.notes ? 'notes' : undefined, leadValue: result.notes, reply: result.reply, nextStep };
  }

  // CLOSING/MESSAGE/HANDOFF/SEND_PACKAGE don't accept further input as the CURRENT
  // step — they auto-chain or end the session, so the session should already have
  // moved past them by now. Treat any stray reply as "flow's over."
  return { kind: 'ADVANCE', nextStep: null };
}

// --- Sending (external call — outside any transaction) ----------------------

interface SendResult {
  ok: boolean;
  externalMessageId?: string;
  errorMessage?: string;
}

async function attemptSend(
  organizationId: string,
  channel: 'WHATSAPP' | 'INSTAGRAM',
  externalContactId: string,
  body: string,
): Promise<SendResult | null> {
  // A short read-only lookup, its own fast transaction — not held open across the send below.
  const connection = await withTenant(organizationId, (tx) =>
    tx.channelConnection.findUnique({ where: { organizationId_channel: { organizationId, channel } } }),
  );
  if (!connection?.credentials) return null; // channel got disconnected mid-flow — nothing safe to do

  try {
    if (channel === 'WHATSAPP') {
      const creds = decryptJson<WhatsAppCredentials>(connection.credentials);
      const sent = await sendWhatsAppText(creds.phoneNumberId, creds.accessToken, externalContactId, body);
      return { ok: true, externalMessageId: sent.externalMessageId };
    }
    const creds = decryptJson<InstagramCredentials>(connection.credentials);
    const sent = await sendInstagramText(creds.igUserId, creds.accessToken, externalContactId, body);
    return { ok: true, externalMessageId: sent.externalMessageId };
  } catch (err) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : 'Send failed' };
  }
}

async function recordOutbound(organizationId: string, conversationId: string, body: string, result: SendResult | null): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    await tx.message.create({
      data: {
        organizationId,
        conversationId,
        direction: 'OUTBOUND',
        body,
        status: result?.ok ? 'SENT' : 'FAILED',
        externalMessageId: result?.externalMessageId,
        errorMessage: result?.errorMessage,
        sentById: null,
      },
    });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 200) } });
  });
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** SEND_PACKAGE's content — same shareable-summary shape the Inbox's "Send" package button uses, built server-side. */
async function buildPackageContent(organizationId: string, packageId: string | undefined): Promise<string | null> {
  if (!packageId) return null;
  const pkg = await withTenant(organizationId, (tx) => tx.package.findUnique({ where: { id: packageId } }));
  if (!pkg || pkg.organizationId !== organizationId) return null;
  const priceText = pkg.priceAmount != null ? formatMoney(pkg.priceAmount, pkg.priceCurrency) : null;
  const lines = [`*${pkg.name}* — ${pkg.destination}`, `${pkg.days}D / ${pkg.nights}N${priceText ? ` · ${priceText}` : ''}`];
  if (pkg.whatsappDescription) lines.push('', pkg.whatsappDescription);
  lines.push('', `${env.CORS_ORIGIN}/p/${pkg.id}`);
  return lines.join('\n');
}

// --- Phase 3: commit — fast, DB-only transactions ----------------------------

async function writeLeadField(organizationId: string, leadId: string | null, field: string, rawValue: unknown): Promise<void> {
  if (!leadId || rawValue == null) return;
  await withTenant(organizationId, async (tx) => {
    if (field === LEAD_DATE_FIELD) {
      const d = new Date(String(rawValue));
      if (Number.isNaN(d.getTime())) return; // couldn't parse — leave the existing value alone rather than corrupt it
      await tx.lead.updateMany({ where: { id: leadId, organizationId }, data: { travelDate: d } });
      return;
    }
    if (field === LEAD_INT_FIELD) {
      const n = typeof rawValue === 'number' ? rawValue : parseInt(String(rawValue).replace(/\D/g, ''), 10);
      if (!Number.isFinite(n) || n <= 0) return;
      await tx.lead.updateMany({ where: { id: leadId, organizationId }, data: { travelerCount: n } });
      return;
    }
    const text = String(rawValue).trim().slice(0, 2000);
    if (!text) return;
    await tx.lead.updateMany({ where: { id: leadId, organizationId }, data: { [field]: text } });
  });
}

/**
 * Advances one conversation's session by exactly one inbound message.
 * `messageBody` is the newest unprocessed inbound message's text.
 */
export async function advanceBotFlow(
  organizationId: string,
  conversationId: string,
  messageBody: string,
  messageCreatedAt: Date,
): Promise<void> {
  const state = await loadState(organizationId, conversationId);
  if (!state) return;

  const action = await decide(state, messageBody, organizationId);

  if (action.kind === 'NEEDS_REVIEW') {
    await withTenant(organizationId, async (tx) => {
      await tx.botFlowSession.update({ where: { id: state.sessionId }, data: { status: 'NEEDS_REVIEW', lastProcessedMessageAt: messageCreatedAt } });
      if (state.conversation.leadId) {
        await tx.lead.updateMany({ where: { id: state.conversation.leadId, organizationId }, data: { needsReview: true, needsReviewReason: action.reason } });
      }
    });
    return; // no auto-response — hands off to a human, per spec
  }

  if (action.kind === 'REPEAT_FALLBACK') {
    const result = await attemptSend(organizationId, state.conversation.channel, state.conversation.externalContactId, state.flowFallbackMessage);
    await recordOutbound(organizationId, conversationId, state.flowFallbackMessage, result);
    await withTenant(organizationId, (tx) => tx.botFlowSession.update({ where: { id: state.sessionId }, data: { lastProcessedMessageAt: messageCreatedAt } }));
    return;
  }

  if (action.kind === 'REPLY_AND_STAY') {
    const result = await attemptSend(organizationId, state.conversation.channel, state.conversation.externalContactId, action.reply);
    await recordOutbound(organizationId, conversationId, action.reply, result);
    await withTenant(organizationId, (tx) => tx.botFlowSession.update({ where: { id: state.sessionId }, data: { lastProcessedMessageAt: messageCreatedAt } }));
    return;
  }

  // action.kind === 'ADVANCE'
  if (action.leadField) {
    await writeLeadField(organizationId, state.conversation.leadId, action.leadField, action.leadValue);
  }
  if (action.reply) {
    const result = await attemptSend(organizationId, state.conversation.channel, state.conversation.externalContactId, action.reply);
    await recordOutbound(organizationId, conversationId, action.reply, result);
  }

  // Walk forward through any run of non-interactive steps (MESSAGE, SEND_PACKAGE),
  // sending each one and auto-chaining, until hitting an interactive step
  // (COLLECT/CONFIRM/AI_OPEN — send its message and stop, waiting for a reply),
  // a terminal step (CLOSING/HANDOFF), or the end of the flow.
  let cursor = action.nextStep;
  let sessionStatus: 'ACTIVE' | 'COMPLETED' | 'NEEDS_REVIEW' = 'ACTIVE';
  let needsReviewReason: string | null = null;

  while (cursor) {
    if (cursor.type === 'HANDOFF') {
      if (cursor.question) {
        const result = await attemptSend(organizationId, state.conversation.channel, state.conversation.externalContactId, cursor.question);
        await recordOutbound(organizationId, conversationId, cursor.question, result);
      }
      sessionStatus = 'NEEDS_REVIEW';
      needsReviewReason = cursor.question ? `Flow handoff step: "${cursor.question}"` : 'Flow handoff step';
      cursor = null;
      break;
    }

    if (cursor.type === 'SEND_PACKAGE') {
      const config = (cursor.config ?? {}) as { packageId?: string };
      const text = await buildPackageContent(organizationId, config.packageId);
      if (text) {
        const result = await attemptSend(organizationId, state.conversation.channel, state.conversation.externalContactId, text);
        await recordOutbound(organizationId, conversationId, text, result);
      }
      cursor = cursor.nextStepId ? state.steps.find((s) => s.id === cursor!.nextStepId) ?? null : null;
      continue;
    }

    if (NON_INTERACTIVE_TYPES.includes(cursor.type)) {
      // MESSAGE
      if (cursor.question) {
        const result = await attemptSend(organizationId, state.conversation.channel, state.conversation.externalContactId, cursor.question);
        await recordOutbound(organizationId, conversationId, cursor.question, result);
      }
      cursor = cursor.nextStepId ? state.steps.find((s) => s.id === cursor!.nextStepId) ?? null : null;
      continue;
    }

    // Interactive (COLLECT/CONFIRM/AI_OPEN) or terminal (CLOSING) — send its
    // message, then stop the chain here.
    if (cursor.question) {
      const result = await attemptSend(organizationId, state.conversation.channel, state.conversation.externalContactId, cursor.question);
      await recordOutbound(organizationId, conversationId, cursor.question, result);
    }
    if (cursor.type === 'CLOSING') sessionStatus = 'COMPLETED';
    break;
  }

  if (!cursor && sessionStatus === 'ACTIVE') sessionStatus = 'COMPLETED'; // walked off the end of the flow

  await withTenant(organizationId, async (tx) => {
    await tx.botFlowSession.update({
      where: { id: state.sessionId },
      data: { currentStepId: cursor?.id ?? null, status: sessionStatus, lastProcessedMessageAt: messageCreatedAt },
    });
    if (sessionStatus === 'NEEDS_REVIEW' && state.conversation.leadId) {
      await tx.lead.updateMany({ where: { id: state.conversation.leadId, organizationId }, data: { needsReview: true, needsReviewReason } });
    }
  });
}
