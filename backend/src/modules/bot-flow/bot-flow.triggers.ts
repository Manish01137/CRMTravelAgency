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
  /** Channels the triggers apply to. */
  channels: BotChannelName[];
}

export type BotChannelName = 'WHATSAPP' | 'INSTAGRAM';
export const ALL_CHANNELS: BotChannelName[] = ['WHATSAPP', 'INSTAGRAM'];

/** A stored channel list, defaulting to both when empty or unreadable. */
export function toChannels(v: unknown): BotChannelName[] {
  const list = Array.isArray(v) ? v.filter((c): c is BotChannelName => c === 'WHATSAPP' || c === 'INSTAGRAM') : [];
  return list.length > 0 ? [...new Set(list)] : ALL_CHANNELS;
}

export interface FlowRouting {
  /** Active flows with at least one trigger. */
  triggered: TriggerFlow[];
  /** The channel's default flow, if one is assigned and active. */
  defaultFlowId: string | null;
  /** When the default flow was assigned — it only greets messages after that. */
  defaultSince: Date | null;
  /** Active flows that start again when a returning customer says "hi". */
  restartOnGreeting: Set<string>;
}

/** Mid-flow, "hi" restarts only after this much silence — otherwise it may be an answer. */
export const ACTIVE_RESTART_QUIET_MS = 30 * 60 * 1000;
/** A chat a teammate took over restarts only after a day of silence. */
export const HANDOFF_RESTART_QUIET_MS = 24 * 60 * 60 * 1000;

const GREETING =
  /^(hi+|hey+|hello+|helo+|hlo+|hellow|hola|hai|namaste|namaskar|namaskaram|start|menu|restart|good (morning|afternoon|evening|day)|gm)( (there|sir|mam|maam|madam|team|bro|ji|all|everyone))?$/;

/** The whole message is just a greeting ("Hi!", "hello 👋", "Good morning sir") — not "hi, I want Manali". */
export function isGreeting(message: string): boolean {
  return GREETING.test(normalize(message));
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

/**
 * The flow a returning customer's "hi" starts again: a flow that has the
 * greeting as a keyword, else the channel's default flow, else the flow they
 * were last in — each only if its "start again on hi" setting is on.
 */
export function chooseFlowForGreeting(
  routing: FlowRouting,
  message: string,
  previousFlowId: string | null,
  messageAt: Date = new Date(),
): string | null {
  if (Date.now() - messageAt.getTime() > START_WINDOW_MS || !isGreeting(message)) return null;
  const keyword = matchKeywordFlow(routing.triggered, message);
  if (keyword) return keyword;
  if (routing.defaultFlowId && routing.restartOnGreeting.has(routing.defaultFlowId)) return routing.defaultFlowId;
  return previousFlowId && routing.restartOnGreeting.has(previousFlowId) ? previousFlowId : null;
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export function toTriggerFlow(row: {
  id: string;
  triggerKeywords: unknown;
  keywordMatch: string;
  triggerAdIds: unknown;
  triggerChannels?: unknown;
}): TriggerFlow {
  return {
    id: row.id,
    triggerKeywords: strings(row.triggerKeywords),
    keywordMatch: row.keywordMatch === 'exact' ? 'exact' : 'contains',
    triggerAdIds: strings(row.triggerAdIds),
    channels: toChannels(row.triggerChannels),
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
    select: { id: true, triggerKeywords: true, keywordMatch: true, triggerAdIds: true, triggerChannels: true, restartOnGreeting: true },
    orderBy: { createdAt: 'asc' },
  });
  const assignment = await tx.botFlowAssignment.findUnique({
    where: { organizationId_channel: { organizationId, channel } },
    include: { flow: { select: { isActive: true } } },
  });
  return {
    triggered: flows
      .map(toTriggerFlow)
      .filter((f) => f.channels.includes(channel) && (f.triggerKeywords.length > 0 || f.triggerAdIds.length > 0)),
    defaultFlowId: assignment?.flow.isActive ? assignment.flowId : null,
    defaultSince: assignment?.flow.isActive ? assignment.updatedAt : null,
    restartOnGreeting: new Set(flows.filter((f) => f.restartOnGreeting).map((f) => f.id)),
  };
}

/** True when Bot Flow is in use on this channel at all — Smart Bot stays off then, so a chat never gets two bots. */
export const botFlowInUse = (routing: FlowRouting) => routing.defaultFlowId !== null || routing.triggered.length > 0;
