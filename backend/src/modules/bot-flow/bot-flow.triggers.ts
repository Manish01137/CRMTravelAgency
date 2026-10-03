import type { TenantTx } from '../../lib/prisma';

/**
 * Which flow a chat runs. An org can have several flows: each may be started
 * by keywords and/or by Meta ads, and each channel may have one default flow
 * (BotFlowAssignment) for everything else. For a new chat: a flow linked to
 * the ad the lead came from wins, then a keyword match, then the default.
 * A chat whose flow has finished restarts only on a keyword match, so the
 * bot never answers the same customer twice unasked.
 *
 * Pure matching here; the poller, the engine and the webhook all share it.
 */

export interface TriggerFlow {
  id: string;
  triggerKeywords: string[];
  keywordMatch: 'contains' | 'exact';
  triggerAdIds: string[];
}

export interface FlowRouting {
  /** Active flows with at least one trigger. */
  triggered: TriggerFlow[];
  /** The channel's default flow, if one is assigned and active. */
  defaultFlowId: string | null;
  /** When the default flow was assigned — it only greets messages after that. */
  defaultSince: Date | null;
}

/** A flow never starts on an older message — WhatsApp wouldn't deliver a free-form reply after 24h anyway. */
export const START_WINDOW_MS = 24 * 60 * 60 * 1000;

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The keyword this message triggers, if any. "contains" = whole word/phrase anywhere ("hi" never matches "this"). */
function matchedKeyword(flow: TriggerFlow, message: string): string | null {
  const text = normalize(message);
  if (!text) return null;
  let best: string | null = null;
  for (const raw of flow.triggerKeywords) {
    const kw = normalize(raw);
    if (!kw) continue;
    const hit = flow.keywordMatch === 'exact' ? text === kw : ` ${text} `.includes(` ${kw} `);
    if (hit && (!best || kw.length > best.length)) best = kw;
  }
  return best;
}

/** The flow whose keyword this message matches — the most specific (longest) keyword wins. */
export function matchKeywordFlow(flows: TriggerFlow[], message: string): string | null {
  let best: { id: string; len: number } | null = null;
  for (const f of flows) {
    const kw = matchedKeyword(f, message);
    if (kw && (!best || kw.length > best.len)) best = { id: f.id, len: kw.length };
  }
  return best?.id ?? null;
}

export function matchAdFlow(flows: TriggerFlow[], adId: string | null | undefined): string | null {
  if (!adId) return null;
  return flows.find((f) => f.triggerAdIds.includes(adId))?.id ?? null;
}

/**
 * The flow a brand-new chat starts with, or null when no flow applies (the
 * bot stays quiet). Turning a flow on never answers chats that were already
 * waiting: the default flow only takes messages from after it was assigned.
 */
export function chooseFlowForNewChat(
  routing: FlowRouting,
  message: string,
  adId: string | null | undefined,
  messageAt: Date = new Date(),
): string | null {
  if (Date.now() - messageAt.getTime() > START_WINDOW_MS) return null;
  const triggered = matchAdFlow(routing.triggered, adId) ?? matchKeywordFlow(routing.triggered, message);
  if (triggered) return triggered;
  return routing.defaultFlowId && routing.defaultSince && messageAt >= routing.defaultSince ? routing.defaultFlowId : null;
}

/** A finished chat restarts only on a keyword, and only for a recent message. */
export function chooseFlowForRestart(routing: FlowRouting, message: string, messageAt: Date = new Date()): string | null {
  if (Date.now() - messageAt.getTime() > START_WINDOW_MS) return null;
  return matchKeywordFlow(routing.triggered, message);
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function toTriggerFlow(row: { id: string; triggerKeywords: unknown; keywordMatch: string; triggerAdIds: unknown }): TriggerFlow {
  return {
    id: row.id,
    triggerKeywords: strings(row.triggerKeywords),
    keywordMatch: row.keywordMatch === 'exact' ? 'exact' : 'contains',
    triggerAdIds: strings(row.triggerAdIds),
  };
}

/**
 * Loads routing for one org + channel inside a tenant transaction. Triggered
 * flows work on both WhatsApp and Instagram — as long as the channel is connected.
 */
export async function loadFlowRouting(tx: TenantTx, organizationId: string, channel: 'WHATSAPP' | 'INSTAGRAM'): Promise<FlowRouting> {
  // Sequential — an interactive transaction uses one connection.
  const flows = await tx.botFlow.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, triggerKeywords: true, keywordMatch: true, triggerAdIds: true },
    orderBy: { createdAt: 'asc' },
  });
  const assignment = await tx.botFlowAssignment.findUnique({
    where: { organizationId_channel: { organizationId, channel } },
    include: { flow: { select: { isActive: true } } },
  });
  return {
    triggered: flows.map(toTriggerFlow).filter((f) => f.triggerKeywords.length > 0 || f.triggerAdIds.length > 0),
    defaultFlowId: assignment?.flow.isActive ? assignment.flowId : null,
    defaultSince: assignment?.flow.isActive ? assignment.updatedAt : null,
  };
}

/** True when Bot Flow is in use on this channel at all — Smart Bot stays off then, so a chat never gets two bots. */
export const botFlowInUse = (routing: FlowRouting) => routing.defaultFlowId !== null || routing.triggered.length > 0;
