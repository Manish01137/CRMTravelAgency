import { Prisma } from '@prisma/client';
import { withTenant } from '../../lib/prisma';
import { extractLeadFields, classifyYesNo, runOpenStep, DEFAULT_GEMINI_MODEL, type ConversationTurn } from '../../lib/gemini';
import { loadAgentContext } from '../ai-agent/ai-agent.service';
import { attemptSend, recordOutbound, sendChoices, sendMediaMessage, sendPackage, sendPackageCarousel, type StepMedia } from './bot-send';
import { defaultAnswerType, validateAnswer, parseTravelDate, DEFAULT_ERROR_MESSAGES, type AnswerType } from '../../lib/answerValidation';
import { matchPackagesInText } from '../../lib/packageMatch';
import { isPlaceholderBody, isReactionBody, TYPE_YOUR_REPLY } from '../../lib/whatsappInbound';
import { findAdPackages } from '../ad-package-mappings/ad-package-mappings.service';
import {
  ACTIVE_RESTART_QUIET_MS,
  HANDOFF_RESTART_QUIET_MS,
  chooseFlowForGreeting,
  chooseFlowForNewChat,
  chooseFlowForRestart,
  loadFlowRouting,
} from './bot-flow.triggers';
import { updateLead } from '../leads/leads.service';
import { updateLeadSchema } from '../leads/leads.schemas';
import { runAiFollowUp } from './bot-flow.followup';
import { SETTABLE_LEAD_FIELDS } from './bot-flow.schemas';

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

type StepType =
  | 'COLLECT'
  | 'CONFIRM'
  | 'CLOSING'
  | 'MESSAGE'
  | 'HANDOFF'
  | 'SEND_PACKAGE'
  | 'AI_OPEN'
  | 'CAROUSEL'
  | 'SET_ATTRIBUTE'
  | 'ADD_TAG'
  | 'UPDATE_STAGE';
type ConfirmOption = { label: string; description?: string; nextStepId: string | null };
/** COLLECT: what a valid answer looks like, how many tries, what to say on a bad one. */
type CollectConfig = { validation?: AnswerType; maxAttempts?: number; errorMessage?: string };
/** CONFIRM: the label on the button that opens a WhatsApp list menu (4+ options). */
type ConfirmConfig = { buttonLabel?: string; media?: StepMedia };

const DEFAULT_MAX_ATTEMPTS = 3;

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
  conversation: { id: string; channel: 'WHATSAPP' | 'INSTAGRAM'; externalContactId: string; leadId: string | null; createdAt: Date };
  /** Ads → Packages attribution on this conversation's lead — see openingAdPackages / the walk below. */
  lead: { destination: string | null; createdAt: Date } | null;
  /** Packages linked to the ad this lead came from (empty for non-ad leads or unlinked ads). */
  adPackageIds: string[];
  sessionId: string;
  sessionStatus: 'ACTIVE' | 'COMPLETED' | 'NEEDS_REVIEW';
  currentStepId: string | null;
  /** Session scratch space — `_retry` counts invalid answers per step. */
  collectedData: Record<string, unknown>;
  flowFallbackMessage: string;
  flowNeedsReviewKeywords: string[];
  steps: StepRow[];
}

type Action =
  | { kind: 'NEEDS_REVIEW'; reason: string }
  | { kind: 'REPEAT_FALLBACK' }
  | { kind: 'REPLY_AND_STAY'; reply: string; retry?: { stepId: string; count: number } }
  | { kind: 'IGNORE' }
  | { kind: 'ADVANCE'; leadField?: string; leadValue?: unknown; reply?: string; packages?: string[]; nextStep: StepRow | null };

const LEAD_DATE_FIELD = 'travelDate';
const LEAD_INT_FIELD = 'travelerCount';
const NON_INTERACTIVE_TYPES: StepType[] = ['MESSAGE', 'SEND_PACKAGE'];
/** Steps that change the lead and move straight on — nothing is sent. */
const LEAD_UPDATE_TYPES: StepType[] = ['SET_ATTRIBUTE', 'ADD_TAG', 'UPDATE_STAGE'];

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

/**
 * The ad-linked packages to open this session with (possibly none). Only when the
 * lead was created together with this conversation from a linked ad
 * (recordInbound tags it in the same transaction) and nothing has been sent
 * here yet — webhooks.service.ts sends the package itself in every other
 * case, so this is what keeps it from ever going out twice.
 */
async function openingAdPackages(state: LoadedState, organizationId: string): Promise<string[]> {
  const lead = state.lead;
  if (!lead || state.adPackageIds.length === 0) return [];
  const createdWithConversation = Math.abs(lead.createdAt.getTime() - state.conversation.createdAt.getTime()) < 60_000;
  if (!createdWithConversation) return [];
  const outbound = await withTenant(organizationId, (tx) =>
    tx.message.count({ where: { conversationId: state.conversation.id, direction: 'OUTBOUND' } }),
  );
  return outbound === 0 ? state.adPackageIds : [];
}

// --- Phase 1: load everything needed to decide, in one fast transaction -----

async function loadState(
  organizationId: string,
  conversationId: string,
  messageBody: string,
  messageCreatedAt: Date,
): Promise<LoadedState | { aiFollowUpSessionId: string } | null> {
  return withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation || (conversation.channel !== 'WHATSAPP' && conversation.channel !== 'INSTAGRAM')) return null;

    // Which flow — see bot-flow.triggers.ts.
    const routing = await loadFlowRouting(tx, organizationId, conversation.channel);
    let session = await tx.botFlowSession.findUnique({ where: { conversationId } });

    if (session) {
      // A returning customer's keyword, or just "hi", starts a flow again:
      //   - finished chat: straight away;
      //   - mid-flow: 30 min after the bot's last message (sooner, "hi" may
      //     be the answer to its question);
      //   - handed to a teammate: once no teammate has replied for a day — or
      //     30 min after the hand-off if nobody on the team ever replied, so a
      //     customer is never left unanswered.
      // Only OUR messages count as activity: a customer's own repeated "hi"s
      // must never hold the bot back.
      const sinceLastOutbound = async (byTeammate: boolean) => {
        const last = await tx.message.findFirst({
          where: { conversationId, direction: 'OUTBOUND', createdAt: { lt: messageCreatedAt }, ...(byTeammate ? { sentById: { not: null } } : {}) },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        });
        return last ? messageCreatedAt.getTime() - last.createdAt.getTime() : null;
      };
      let restartFlowId: string | null = null;
      if (session.status === 'COMPLETED') {
        restartFlowId = chooseFlowForRestart(routing, messageBody, messageCreatedAt) ?? chooseFlowForGreeting(routing, messageBody, session.flowId, messageCreatedAt);
      } else {
        const greetingFlowId = chooseFlowForGreeting(routing, messageBody, session.flowId, messageCreatedAt);
        if (greetingFlowId && session.status === 'NEEDS_REVIEW') {
          const teammate = await sinceLastOutbound(true);
          const ok = teammate !== null ? teammate >= HANDOFF_RESTART_QUIET_MS : ((await sinceLastOutbound(false)) ?? Infinity) >= ACTIVE_RESTART_QUIET_MS;
          if (ok) restartFlowId = greetingFlowId;
        } else if (greetingFlowId && session.currentStepId !== null) {
          if (((await sinceLastOutbound(false)) ?? Infinity) >= ACTIVE_RESTART_QUIET_MS) restartFlowId = greetingFlowId;
        }
      }
      if (restartFlowId) {
        const wasHandedOff = session.status === 'NEEDS_REVIEW';
        session = await tx.botFlowSession.update({
          where: { id: session.id },
          data: { flowId: restartFlowId, status: 'ACTIVE', currentStepId: null, collectedData: {} },
        });
        // The bot is looking after this chat again.
        if (wasHandedOff && conversation.leadId) {
          await tx.lead.updateMany({ where: { id: conversation.leadId, organizationId }, data: { needsReview: false, needsReviewReason: null } });
        }
      } else if (session.status === 'COMPLETED' && routing.aiFollowUp.has(session.flowId)) {
        // A finished chat with a new request — the AI assistant looks after it (bot-flow.followup.ts).
        return { aiFollowUpSessionId: session.id };
      } else if (session.status !== 'ACTIVE') {
        // Finished, or a teammate's chat — the bot stays out of it.
        await tx.botFlowSession.update({ where: { id: session.id }, data: { lastProcessedMessageAt: messageCreatedAt } });
        return null;
      }
    }
    if (!session) {
      const sourceAdId = conversation.leadId
        ? (await tx.lead.findUnique({ where: { id: conversation.leadId }, select: { sourceAdId: true } }))?.sourceAdId
        : null;
      const flowId = chooseFlowForNewChat(routing, messageBody, sourceAdId, messageCreatedAt);
      if (!flowId) return null; // no flow applies to this chat
      // upsert, not create: the scheduled poller (every 10s) and a manually
      // triggered scan can both reach this for the same brand-new conversation.
      session = await tx.botFlowSession.upsert({
        where: { conversationId },
        create: { organizationId, conversationId, flowId, status: 'ACTIVE' },
        update: {},
      });
    }
    if (session.status !== 'ACTIVE') return null;

    const flow = await tx.botFlow.findUnique({ where: { id: session.flowId }, include: { steps: { orderBy: { order: 'asc' } } } });
    if (!flow) return null;

    const leadRow = conversation.leadId
      ? await tx.lead.findUnique({
          where: { id: conversation.leadId },
          select: { sourceAdId: true, sourcePackageId: true, destination: true, createdAt: true },
        })
      : null;
    // sourcePackageId is only set when the ad was linked at click time; the
    // current link decides which packages count (it may have been edited).
    const adPackageIds =
      leadRow?.sourceAdId && leadRow.sourcePackageId
        ? (await findAdPackages(tx, organizationId, leadRow.sourceAdId)).map((p) => p.id)
        : [];
    const lead = leadRow ? { destination: leadRow.destination, createdAt: leadRow.createdAt } : null;

    return {
      conversation: {
        id: conversation.id,
        channel: conversation.channel,
        externalContactId: conversation.externalContactId,
        leadId: conversation.leadId,
        createdAt: conversation.createdAt,
      },
      lead,
      adPackageIds,
      sessionId: session.id,
      sessionStatus: session.status,
      currentStepId: session.currentStepId,
      collectedData:
        session.collectedData && typeof session.collectedData === 'object' && !Array.isArray(session.collectedData)
          ? (session.collectedData as Record<string, unknown>)
          : {},
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

async function decide(
  state: LoadedState,
  messageBody: string,
  organizationId: string,
  interactiveSelectionId: string | null,
): Promise<Action> {
  const placeholder = !interactiveSelectionId && isPlaceholderBody(messageBody);
  const matched = placeholder ? null : matchesKeyword(messageBody, state.flowNeedsReviewKeywords);
  if (matched) return { kind: 'NEEDS_REVIEW', reason: `Matched "Needs Review" keyword: "${matched}"` };

  const agent = await loadAgentContext(organizationId).catch(() => null);
  const currentStep = state.currentStepId ? state.steps.find((s) => s.id === state.currentStepId) ?? null : null;

  // Mid-flow, a voice note / sticker / message WhatsApp won't share is not an
  // answer — ask for a typed reply instead of storing the label (a reaction
  // just passes). A brand-new session still opens normally below.
  if (currentStep && placeholder) {
    return isReactionBody(messageBody) ? { kind: 'IGNORE' } : { kind: 'REPLY_AND_STAY', reply: TYPE_YOUR_REPLY };
  }

  if (!currentStep) {
    // Brand-new session: the inbound message just triggered the flow — open
    // with the first step, preceded by the ad's package when this lead came
    // from a linked Click-to-WhatsApp ad.
    return { kind: 'ADVANCE', packages: await openingAdPackages(state, organizationId), nextStep: findStartStep(state.steps) };
  }

  if (currentStep.type === 'COLLECT') {
    const config = (currentStep.config ?? {}) as CollectConfig;
    const answerType = config.validation ?? defaultAnswerType(currentStep.leadField);
    const nextStep = currentStep.nextStepId ? state.steps.find((s) => s.id === currentStep.nextStepId) ?? null : null;

    // The answer as typed first — a date, number, email, phone or a short
    // answer ("Manali", "Rahul") needs no AI, which keeps the reply instant.
    // Only a longer sentence ("we're 4 friends planning Manali in Dec") or an
    // answer that doesn't check out goes to the AI to read.
    const typed = validateAnswer(answerType, messageBody);
    const wordCount = messageBody.trim().split(/\s+/).length;
    const plainShortAnswer = wordCount <= 3 && !/^(i am|i'm|im|my|we are|we're|it is|it's|its)\b/i.test(messageBody.trim());
    let valid = typed.ok && (answerType !== 'text' || plainShortAnswer) ? typed : null;
    if (!valid && currentStep.leadField && agent) {
      const extracted = await extractLeadFields(agent.apiKey, DEFAULT_GEMINI_MODEL, messageBody).catch(() => ({}));
      const extractedValue = extracted[currentStep.leadField as keyof typeof extracted] ?? null;
      const fromAi = extractedValue != null ? validateAnswer(answerType, extractedValue) : null;
      valid = fromAi?.ok ? fromAi : typed.ok ? typed : null;
    }
    if (!valid && typed.ok) valid = typed;
    if (valid?.ok) return { kind: 'ADVANCE', leadField: currentStep.leadField ?? undefined, leadValue: valid.value, nextStep };

    // Invalid — ask again, up to the step's attempt limit, then move on without saving it.
    const retries = (state.collectedData._retry ?? {}) as Record<string, number>;
    const count = (retries[currentStep.id] ?? 0) + 1;
    const maxAttempts = config.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    if (count < maxAttempts) {
      const reply = config.errorMessage?.trim() || DEFAULT_ERROR_MESSAGES[answerType];
      return { kind: 'REPLY_AND_STAY', reply, retry: { stepId: currentStep.id, count } };
    }
    return { kind: 'ADVANCE', nextStep };
  }

  if (currentStep.type === 'CONFIRM') {
    const options = (Array.isArray(currentStep.options) ? currentStep.options : []) as ConfirmOption[];
    const lower = messageBody.trim().toLowerCase();
    let matchedOption: ConfirmOption | undefined;

    // 1. A tapped button / list row on THIS question (an old message's tap falls through to its text).
    const tapPrefix = `${currentStep.id}:`;
    if (interactiveSelectionId?.startsWith(tapPrefix)) {
      matchedOption = options[parseInt(interactiveSelectionId.slice(tapPrefix.length), 10)];
    }
    // 2. "2" / "2." — the number from the text version of the options.
    const numbered = lower.match(/^(\d{1,2})\.?$/);
    if (!matchedOption && numbered) matchedOption = options[parseInt(numbered[1], 10) - 1];
    // 3. The option's own words (exact first, then contained either way).
    if (!matchedOption && lower) {
      matchedOption =
        options.find((o) => o.label.trim().toLowerCase() === lower) ??
        options.find((o) => lower.includes(o.label.toLowerCase()) || o.label.toLowerCase().includes(lower));
    }

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

  if (currentStep.type === 'CAROUSEL') {
    const config = (currentStep.config ?? {}) as { packageIds?: string[] };
    const packageIds = config.packageIds ?? [];
    // The carousel's buttons open each package's page, so a reply here is
    // either a package named in text ("kashmir") — send that one — or
    // anything else, which just moves the flow on. (A tap on a row of the
    // older list-style message still counts as a pick.)
    let picked = interactiveSelectionId && packageIds.includes(interactiveSelectionId) ? interactiveSelectionId : null;
    if (!picked && messageBody.trim() && packageIds.length > 0) {
      const candidates = await withTenant(organizationId, (tx) =>
        tx.package.findMany({ where: { id: { in: packageIds }, organizationId }, select: { id: true, name: true, destination: true } }),
      );
      const matches = matchPackagesInText(messageBody, candidates);
      if (matches.length === 1) picked = matches[0].id;
    }
    const nextStep = currentStep.nextStepId ? state.steps.find((s) => s.id === currentStep.nextStepId) ?? null : null;
    return { kind: 'ADVANCE', packages: picked ? [picked] : [], nextStep };
  }

  // CLOSING/MESSAGE/HANDOFF/SEND_PACKAGE don't accept further input as the CURRENT
  // step — they auto-chain or end the session, so the session should already have
  // moved past them by now. Treat any stray reply as "flow's over."
  return { kind: 'ADVANCE', nextStep: null };
}

/**
 * SEND_PACKAGE with multiple candidate packageIds configured: picks the one
 * whose destination matches the lead's own Lead.destination (already
 * collected earlier in the flow, typically by a COLLECT step) instead of
 * always sending a single hardcoded package. Falls back to the first
 * candidate when there's only one, no lead, no destination collected yet, or
 * none of the candidates match — SEND_PACKAGE always sends SOMETHING once
 * configured, same as before this existed.
 */
async function pickPackageForLead(organizationId: string, packageIds: string[], leadId: string | null): Promise<string | undefined> {
  if (packageIds.length <= 1) return packageIds[0];
  if (!leadId) return packageIds[0];

  const lead = await withTenant(organizationId, (tx) => tx.lead.findUnique({ where: { id: leadId }, select: { destination: true } }));
  const wanted = lead?.destination?.trim().toLowerCase();
  if (!wanted) return packageIds[0];

  const candidates = await withTenant(organizationId, (tx) =>
    tx.package.findMany({ where: { id: { in: packageIds }, organizationId }, select: { id: true, destination: true } }),
  );
  const match = candidates.find((p) => {
    const d = p.destination?.trim().toLowerCase();
    return !!d && (d === wanted || d.includes(wanted) || wanted.includes(d));
  });
  return match?.id ?? packageIds[0];
}

// --- Phase 3: commit — fast, DB-only transactions ----------------------------

async function writeLeadField(organizationId: string, leadId: string | null, field: string, rawValue: unknown): Promise<void> {
  if (!leadId || rawValue == null) return;
  await withTenant(organizationId, async (tx) => {
    if (field === LEAD_DATE_FIELD) {
      const d = rawValue instanceof Date ? rawValue : parseTravelDate(String(rawValue));
      if (!d || Number.isNaN(d.getTime())) return; // couldn't parse — leave the existing value alone rather than corrupt it
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

type LeadUpdateConfig = { field?: string; value?: string; tags?: string[]; status?: string };

/** SET_ATTRIBUTE / ADD_TAG / UPDATE_STAGE — change the lead through the normal lead update (validation, timeline, auto-booking on Won). */
async function applyLeadUpdate(organizationId: string, leadId: string | null, step: StepRow): Promise<void> {
  if (!leadId) return;
  const config = (step.config ?? {}) as LeadUpdateConfig;

  if (step.type === 'ADD_TAG') {
    const tags = (config.tags ?? []).map((t) => t.trim()).filter(Boolean);
    if (tags.length === 0) return;
    await withTenant(organizationId, async (tx) => {
      const lead = await tx.lead.findUnique({ where: { id: leadId }, select: { tags: true } });
      if (!lead) return;
      const merged = [...lead.tags];
      for (const t of tags) if (!merged.some((x) => x.toLowerCase() === t.toLowerCase())) merged.push(t);
      if (merged.length !== lead.tags.length) await tx.lead.update({ where: { id: leadId }, data: { tags: merged } });
    });
    return;
  }

  let patch: Record<string, unknown>;
  if (step.type === 'UPDATE_STAGE') {
    patch = { status: config.status };
  } else {
    const field = config.field as (typeof SETTABLE_LEAD_FIELDS)[number] | undefined;
    if (!field || !SETTABLE_LEAD_FIELDS.includes(field) || config.value == null) return;
    let value: unknown = config.value;
    if (field === 'notes') {
      const lead = await withTenant(organizationId, (tx) => tx.lead.findUnique({ where: { id: leadId }, select: { notes: true } }));
      value = [lead?.notes?.trim(), config.value.trim()].filter(Boolean).join('\n').slice(0, 5000);
    }
    patch = { [field]: value };
  }
  const parsed = updateLeadSchema.safeParse(patch);
  if (!parsed.success) {
    console.warn('[bot-flow] skipping invalid lead update in step', step.id, parsed.error.issues[0]?.message);
    return;
  }
  await updateLead(organizationId, leadId, parsed.data);
}

/** A CONFIRM question with its options as WhatsApp buttons / a list menu (numbered text on Instagram). */
async function sendConfirm(organizationId: string, state: LoadedState, step: StepRow): Promise<void> {
  const options = (Array.isArray(step.options) ? step.options : []) as ConfirmOption[];
  const config = (step.config ?? {}) as ConfirmConfig;
  await sendChoices(
    organizationId,
    state.conversation.channel,
    state.conversation.externalContactId,
    state.conversation.id,
    step.question?.trim() || 'Please choose an option:',
    options.map((o, i) => ({ id: `${step.id}:${i}`, label: o.label, description: o.description })),
    config.buttonLabel?.trim() || undefined,
    validMedia(config.media),
  );
}

/** A step's attached photo / video / PDF, if it has a usable one. */
function validMedia(media: StepMedia | undefined): StepMedia | undefined {
  return media && ['image', 'video', 'document'].includes(media.type) && /^https?:\/\//.test(media.url ?? '') ? media : undefined;
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
  interactiveSelectionId: string | null = null,
): Promise<void> {
  const state = await loadState(organizationId, conversationId, messageBody, messageCreatedAt);
  if (!state) return;
  if ('aiFollowUpSessionId' in state) {
    await runAiFollowUp(organizationId, conversationId, state.aiFollowUpSessionId, messageBody, messageCreatedAt);
    return;
  }

  const action = await decide(state, messageBody, organizationId, interactiveSelectionId);

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
    // Didn't match any option — put the buttons back in front of them.
    const current = state.steps.find((s) => s.id === state.currentStepId);
    if (current?.type === 'CONFIRM') await sendConfirm(organizationId, state, current);
    await withTenant(organizationId, (tx) => tx.botFlowSession.update({ where: { id: state.sessionId }, data: { lastProcessedMessageAt: messageCreatedAt } }));
    return;
  }

  if (action.kind === 'IGNORE') {
    await withTenant(organizationId, (tx) => tx.botFlowSession.update({ where: { id: state.sessionId }, data: { lastProcessedMessageAt: messageCreatedAt } }));
    return;
  }

  if (action.kind === 'REPLY_AND_STAY') {
    const result = await attemptSend(organizationId, state.conversation.channel, state.conversation.externalContactId, action.reply);
    await recordOutbound(organizationId, conversationId, action.reply, result);
    const retry = action.retry;
    const collectedData = retry
      ? ({ ...state.collectedData, _retry: { ...((state.collectedData._retry ?? {}) as Record<string, number>), [retry.stepId]: retry.count } } as Prisma.InputJsonValue)
      : undefined;
    await withTenant(organizationId, (tx) =>
      tx.botFlowSession.update({ where: { id: state.sessionId }, data: { lastProcessedMessageAt: messageCreatedAt, ...(collectedData ? { collectedData } : {}) } }),
    );
    return;
  }

  // action.kind === 'ADVANCE'
  if (action.leadField) {
    await writeLeadField(organizationId, state.conversation.leadId, action.leadField, action.leadValue);
  }
  const { channel, externalContactId } = state.conversation;
  if (action.reply) {
    const result = await attemptSend(organizationId, channel, externalContactId, action.reply);
    await recordOutbound(organizationId, conversationId, action.reply, result);
  }
  for (const packageId of action.packages ?? []) {
    await sendPackage(organizationId, channel, externalContactId, conversationId, packageId);
  }

  // Walk forward through any run of non-interactive steps (MESSAGE, SEND_PACKAGE),
  // sending each one and auto-chaining, until hitting an interactive step
  // (COLLECT/CONFIRM/AI_OPEN — send its message and stop, waiting for a reply),
  // a terminal step (CLOSING/HANDOFF), or the end of the flow.
  let cursor = action.nextStep;
  let sessionStatus: 'ACTIVE' | 'COMPLETED' | 'NEEDS_REVIEW' = 'ACTIVE';
  let needsReviewReason: string | null = null;
  // A lead from a linked ad already told us where they want to go (and got
  // that package) — don't ask again, and don't resend the same package.
  const adPackageIds = new Set(state.adPackageIds);
  const destinationKnown = adPackageIds.size > 0 && !!state.lead?.destination;
  const nextOf = (step: StepRow) => (step.nextStepId ? state.steps.find((s) => s.id === step.nextStepId) ?? null : null);
  const visited = new Set<string>();

  while (cursor) {
    if (visited.has(cursor.id)) {
      cursor = null; // steps that loop back on themselves with no question in between — end rather than spin
      break;
    }
    visited.add(cursor.id);

    if (cursor.type === 'COLLECT' && cursor.leadField === 'destination' && destinationKnown) {
      cursor = nextOf(cursor);
      continue;
    }

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

    if (cursor.type === 'CAROUSEL') {
      const config = (cursor.config ?? {}) as { packageIds?: string[] };
      await sendPackageCarousel(organizationId, channel, externalContactId, conversationId, config.packageIds ?? []);
      // Interactive — stop here and wait for the traveller's reply, same as COLLECT/CONFIRM/AI_OPEN below.
      break;
    }

    if (LEAD_UPDATE_TYPES.includes(cursor.type)) {
      await applyLeadUpdate(organizationId, state.conversation.leadId, cursor).catch((err) =>
        console.error('[bot-flow] lead update step failed:', cursor!.id, err instanceof Error ? err.message : err),
      );
      cursor = nextOf(cursor);
      continue;
    }

    if (cursor.type === 'SEND_PACKAGE') {
      const config = (cursor.config ?? {}) as { packageId?: string; packageIds?: string[] };
      const candidateIds = config.packageIds?.length ? config.packageIds : config.packageId ? [config.packageId] : [];
      const chosenId = await pickPackageForLead(organizationId, candidateIds, state.conversation.leadId);
      if (chosenId && !adPackageIds.has(chosenId)) {
        await sendPackage(organizationId, channel, externalContactId, conversationId, chosenId);
      }
      cursor = cursor.nextStepId ? state.steps.find((s) => s.id === cursor!.nextStepId) ?? null : null;
      continue;
    }

    if (NON_INTERACTIVE_TYPES.includes(cursor.type)) {
      // MESSAGE — with its photo / video / PDF when one is attached
      const media = validMedia((cursor.config as { media?: StepMedia } | null)?.media);
      if (media) {
        await sendMediaMessage(organizationId, channel, externalContactId, conversationId, media, cursor.question ?? '');
      } else if (cursor.question) {
        const result = await attemptSend(organizationId, state.conversation.channel, state.conversation.externalContactId, cursor.question);
        await recordOutbound(organizationId, conversationId, cursor.question, result);
      }
      cursor = cursor.nextStepId ? state.steps.find((s) => s.id === cursor!.nextStepId) ?? null : null;
      continue;
    }

    if (cursor.type === 'CONFIRM') {
      await sendConfirm(organizationId, state, cursor);
      break;
    }

    // Interactive (COLLECT/AI_OPEN) or terminal (CLOSING) — send its
    // message, then stop the chain here.
    if (cursor.question) {
      const result = await attemptSend(organizationId, state.conversation.channel, state.conversation.externalContactId, cursor.question);
      await recordOutbound(organizationId, conversationId, cursor.question, result);
    }
    if (cursor.type === 'CLOSING') sessionStatus = 'COMPLETED';
    break;
  }

  if (!cursor && sessionStatus === 'ACTIVE') sessionStatus = 'COMPLETED'; // walked off the end of the flow
  // Attempt counts belong to the question they were for — start fresh on the next one.
  const { _retry: _cleared, ...collectedData } = state.collectedData;

  await withTenant(organizationId, async (tx) => {
    await tx.botFlowSession.update({
      where: { id: state.sessionId },
      data: { currentStepId: cursor?.id ?? null, status: sessionStatus, lastProcessedMessageAt: messageCreatedAt, collectedData: collectedData as Prisma.InputJsonValue },
    });
    if (sessionStatus === 'NEEDS_REVIEW' && state.conversation.leadId) {
      await tx.lead.updateMany({ where: { id: state.conversation.leadId, organizationId }, data: { needsReview: true, needsReviewReason } });
    }
  });
}
