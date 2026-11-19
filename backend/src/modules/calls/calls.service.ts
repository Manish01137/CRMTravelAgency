import type { CallStatus, Prisma } from '@prisma/client';
import { withTenant } from '../../lib/prisma';
import { decryptJson } from '../../lib/encryption';
import { AppError, BadRequest, Conflict, NotFound } from '../../lib/errors';
import { friendlyMetaError } from '../../lib/metaErrors';
import {
  getWhatsAppCallingSettings,
  getWhatsAppCallPermission,
  metaErrorCode,
  sendWhatsAppCallPermissionRequest,
  startWhatsAppCall,
  updateWhatsAppCallingSettings,
  whatsappCallAction,
  type WhatsAppCallingSettings,
  type WhatsAppCallPermission,
} from '../../lib/meta';
import { seesEverything, assertConversationVisible, type Viewer } from '../../lib/visibility';
import { ensureContactConversation } from '../webhooks/webhooks.service';
import type { WhatsAppCredentials } from '../channels/channels.service';
import { publishCallEvent } from './calls.bus';

/**
 * WhatsApp voice calls (Cloud API Calling), answered and made in the browser.
 *
 *   Incoming: Meta's "calls" webhook brings the customer's SDP offer → every
 *   teammate who can see that chat hears it ring → the first to press Answer
 *   claims it, their browser makes the SDP answer, we pre_accept + accept.
 *   Outgoing: the browser makes an SDP offer → we "connect" → the customer's
 *   SDP answer arrives on the webhook and is handed back to that browser.
 *
 * Audio flows browser ↔ WhatsApp directly (WebRTC); we only do the signalling
 * and keep the record: a WhatsAppCall row, a note in the chat and a CALL
 * activity on the lead (so it shows in the Call Log).
 */

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Meta gives up on an unanswered call well before this; it's only a safety net if the end webhook never comes. */
const RING_TIMEOUT_MS = 75_000;
/** A connected call older than this with no end webhook is treated as over (so it can't block new calls forever). */
const STALE_CALL_MS = 4 * 60 * 60 * 1000;

const callInclude = {
  conversation: {
    select: {
      id: true,
      contactName: true,
      contactPhone: true,
      externalContactId: true,
      leadId: true,
      lead: { select: { id: true, name: true, assignedToId: true } },
    },
  },
  answeredBy: { select: { id: true, name: true } },
  startedBy: { select: { id: true, name: true } },
} satisfies Prisma.WhatsAppCallInclude;

type CallRow = Prisma.WhatsAppCallGetPayload<{ include: typeof callInclude }>;
type Tx = Parameters<Parameters<typeof withTenant>[1]>[0];

export function callDto(call: CallRow) {
  return {
    id: call.id,
    direction: call.direction,
    status: call.status,
    conversationId: call.conversationId,
    leadId: call.conversation.leadId,
    contactName: call.conversation.lead?.name || call.conversation.contactName || null,
    contactPhone: call.conversation.contactPhone ?? call.conversation.externalContactId,
    answeredBy: call.answeredBy,
    startedBy: call.startedBy,
    createdAt: call.createdAt,
    answeredAt: call.answeredAt,
    endedAt: call.endedAt,
    durationSec: call.durationSec,
    errorMessage: call.errorMessage,
  };
}
export type CallDto = ReturnType<typeof callDto>;

/** Who hears about a call: an incoming one rings admins + the lead's owner; an outgoing one only matters to whoever placed it. */
function audienceOf(call: CallRow) {
  const ownerId = call.conversation.lead?.assignedToId ?? null;
  return (sub: { userId: string; role: Viewer['role'] }) =>
    call.direction === 'OUTBOUND'
      ? sub.userId === call.startedById
      : seesEverything(sub) || sub.userId === ownerId || sub.userId === call.answeredById;
}

function publish(organizationId: string, call: CallRow, type: 'ring' | 'update' | 'ended', extra: Record<string, unknown> = {}) {
  publishCallEvent(organizationId, { type, call: callDto(call), ...extra }, audienceOf(call));
}

function canHandle(viewer: Viewer, call: CallRow): boolean {
  if (seesEverything(viewer)) return true;
  if (call.direction === 'OUTBOUND') return call.startedById === viewer.userId;
  return call.conversation.lead?.assignedToId === viewer.userId || call.answeredById === viewer.userId;
}

async function loadCall(organizationId: string, viewer: Viewer | null, callId: string): Promise<CallRow> {
  const call = await withTenant(organizationId, (tx) => tx.whatsAppCall.findUnique({ where: { id: callId }, include: callInclude }));
  if (!call || (viewer && !canHandle(viewer, call))) throw NotFound('Call not found');
  return call;
}

async function whatsappCredentials(organizationId: string): Promise<WhatsAppCredentials> {
  const connection = await withTenant(organizationId, (tx) =>
    tx.channelConnection.findUnique({ where: { organizationId_channel: { organizationId, channel: 'WHATSAPP' } } }),
  );
  if (!connection || connection.status !== 'CONNECTED' || !connection.credentials) {
    throw new AppError(400, 'WHATSAPP_NOT_CONNECTED', 'Connect WhatsApp in Settings → Channels before using WhatsApp calls');
  }
  return decryptJson<WhatsAppCredentials>(connection.credentials);
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

/** The line written into the chat when a call ends (also the Inbox preview). */
function callNote(call: CallRow, status: CallStatus, durationSec: number | null, byName: string | null): string {
  const length = durationSec ? ` · ${mmss(durationSec)}` : '';
  if (call.direction === 'INBOUND') {
    if (status === 'COMPLETED') return `📞 WhatsApp call${call.answeredBy ? ` · answered by ${call.answeredBy.name}` : ''}${length}`;
    if (status === 'DECLINED') return `📞 WhatsApp call declined${byName ? ` by ${byName}` : ''}`;
    if (status === 'FAILED') return '📞 WhatsApp call failed to connect';
    return '📞 Missed WhatsApp call';
  }
  const by = call.startedBy ? ` by ${call.startedBy.name}` : '';
  if (status === 'COMPLETED') return `📞 WhatsApp call${by}${length}`;
  if (status === 'DECLINED') return `📞 WhatsApp call${by} · declined by the customer`;
  if (status === 'FAILED') return `📞 WhatsApp call${by} · couldn't connect`;
  return `📞 WhatsApp call${by} · no answer`;
}

const OUTCOME: Record<CallStatus, string> = {
  RINGING: 'Ringing',
  ANSWERED: 'Answered',
  COMPLETED: 'Answered',
  MISSED: 'Missed',
  DECLINED: 'Declined',
  NO_ANSWER: 'Call not picked',
  FAILED: 'Failed',
};

/**
 * Ends a call once (whoever gets there first: our hang-up, Meta's end
 * webhook, the ring timeout) and records it in the chat + on the lead.
 */
async function finalizeCall(
  organizationId: string,
  callId: string,
  status: CallStatus,
  opts: { durationSec?: number | null; errorMessage?: string | null; byUserId?: string | null } = {},
): Promise<void> {
  const call = await withTenant(organizationId, async (tx) => {
    const current = await tx.whatsAppCall.findUnique({ where: { id: callId }, include: callInclude });
    if (!current || current.endedAt) return null;
    const endedAt = new Date();
    const durationSec =
      status === 'COMPLETED'
        ? (opts.durationSec ?? (current.answeredAt ? Math.max(1, Math.round((endedAt.getTime() - current.answeredAt.getTime()) / 1000)) : null))
        : null;
    const claimed = await tx.whatsAppCall.updateMany({
      where: { id: callId, endedAt: null },
      data: { status, endedAt, durationSec, errorMessage: opts.errorMessage ?? null, remoteSdp: null },
    });
    if (!claimed.count) return null;

    const byName = opts.byUserId ? ((await tx.user.findUnique({ where: { id: opts.byUserId }, select: { name: true } }))?.name ?? null) : null;
    const note = callNote(current, status, durationSec, byName);
    // A local note (never sent through Meta) — like "Log call". Credited to the
    // teammate who talked / called, so the Bot Flow sees a human handled this chat.
    const teammateId = current.direction === 'OUTBOUND' ? current.startedById : status === 'COMPLETED' ? current.answeredById : null;
    await tx.message.create({
      data: { organizationId, conversationId: current.conversationId, direction: 'OUTBOUND', body: note, status: 'SENT', sentById: teammateId },
    });
    const missed = current.direction === 'INBOUND' && status === 'MISSED';
    await tx.conversation.update({
      where: { id: current.conversationId },
      data: { lastMessageAt: endedAt, lastMessagePreview: note.slice(0, 200), ...(missed ? { unreadCount: { increment: 1 } } : {}) },
    });
    if (current.conversation.leadId) {
      await tx.leadActivity.create({
        data: {
          organizationId,
          leadId: current.conversation.leadId,
          type: 'CALL',
          outcome: OUTCOME[status],
          message: `${current.direction === 'INBOUND' ? 'Incoming' : 'Outgoing'} WhatsApp call${durationSec ? ` · ${mmss(durationSec)}` : ''}`,
          createdById: teammateId ?? opts.byUserId ?? null,
        },
      });
    }
    return tx.whatsAppCall.findUnique({ where: { id: callId }, include: callInclude });
  });
  if (call) publish(organizationId, call, 'ended');
}

function scheduleRingTimeout(organizationId: string, callId: string, direction: 'INBOUND' | 'OUTBOUND') {
  setTimeout(() => {
    void (async () => {
      const call = await withTenant(organizationId, (tx) => tx.whatsAppCall.findUnique({ where: { id: callId } }));
      if (call && !call.endedAt && call.status === 'RINGING') await finalizeCall(organizationId, callId, direction === 'INBOUND' ? 'MISSED' : 'NO_ANSWER');
    })().catch((err) => console.error('[calls] ring timeout failed:', err instanceof Error ? err.message : err));
  }, RING_TIMEOUT_MS).unref();
}

// --- Webhook side ------------------------------------------------------------

/**
 * Events for a call we haven't stored yet. Meta can send the customer's answer
 * for an outgoing call before our own "connect" request has returned its id.
 */
const pendingEvents = new Map<string, { at: number; run: (() => Promise<void>)[] }>();
function deferUntilKnown(externalCallId: string, run: () => Promise<void>) {
  for (const [id, p] of pendingEvents) if (Date.now() - p.at > 60_000) pendingEvents.delete(id);
  const entry = pendingEvents.get(externalCallId) ?? { at: Date.now(), run: [] };
  entry.run.push(run);
  pendingEvents.set(externalCallId, entry);
}
async function runDeferred(externalCallId: string) {
  const entry = pendingEvents.get(externalCallId);
  if (!entry) return;
  pendingEvents.delete(externalCallId);
  for (const run of entry.run) await run().catch((err) => console.error('[calls] deferred event failed:', err instanceof Error ? err.message : err));
}

async function findByExternalId(organizationId: string, externalCallId: string) {
  return withTenant(organizationId, (tx) => tx.whatsAppCall.findUnique({ where: { externalCallId }, include: callInclude }));
}

interface MetaCallEvent {
  id?: string;
  from?: string;
  to?: string;
  event?: string;
  direction?: string;
  status?: string;
  duration?: number | string;
  session?: { sdp_type?: string; sdp?: string };
  errors?: { code?: number; message?: string; title?: string }[];
}

/** One `field: "calls"` change from Meta's webhook. */
export async function handleCallsWebhook(organizationId: string, value: Record<string, unknown>): Promise<void> {
  const contacts = Array.isArray(value.contacts) ? (value.contacts as { wa_id?: string; profile?: { name?: string } }[]) : [];
  const calls = Array.isArray(value.calls) ? (value.calls as MetaCallEvent[]) : [];
  const statuses = Array.isArray(value.statuses) ? (value.statuses as { id?: string; type?: string; status?: string }[]) : [];

  for (const c of calls) {
    const externalCallId = String(c.id ?? '');
    if (!externalCallId) continue;
    if (c.event === 'connect' && c.session?.sdp_type === 'offer' && c.direction !== 'BUSINESS_INITIATED') {
      const from = String(c.from ?? '');
      if (!from || !c.session.sdp) continue;
      await onIncomingCall(organizationId, externalCallId, from, contacts.find((x) => x.wa_id === from)?.profile?.name ?? null, c.session.sdp);
    } else if (c.event === 'connect' && c.session?.sdp_type === 'answer' && c.session.sdp) {
      await onCustomerAnswerSdp(organizationId, externalCallId, c.session.sdp);
    } else if (c.event === 'terminate') {
      await onCallEnded(organizationId, externalCallId, c);
    }
  }
  for (const st of statuses) {
    if (st.type && st.type !== 'call') continue;
    if (st.id && st.status) await onCallStatus(organizationId, String(st.id), String(st.status).toUpperCase());
  }
}

async function onIncomingCall(organizationId: string, externalCallId: string, from: string, name: string | null, sdp: string) {
  if (await findByExternalId(organizationId, externalCallId)) return; // Meta re-delivered the webhook
  let call: CallRow;
  try {
    call = await withTenant(organizationId, async (tx: Tx) => {
      const { conversation } = await ensureContactConversation(tx, {
        organizationId,
        channel: 'WHATSAPP',
        externalContactId: from,
        contactName: name,
        contactPhone: from,
        leadSource: 'WHATSAPP',
      });
      return tx.whatsAppCall.create({
        data: { organizationId, conversationId: conversation.id, externalCallId, direction: 'INBOUND', status: 'RINGING', remoteSdp: sdp },
        include: callInclude,
      });
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') return; // the same webhook, twice at once
    throw err;
  }
  publish(organizationId, call, 'ring');
  scheduleRingTimeout(organizationId, call.id, 'INBOUND');
}

async function onCustomerAnswerSdp(organizationId: string, externalCallId: string, sdp: string): Promise<void> {
  const call = await findByExternalId(organizationId, externalCallId);
  if (!call) return deferUntilKnown(externalCallId, () => onCustomerAnswerSdp(organizationId, externalCallId, sdp));
  if (call.endedAt) return;
  await withTenant(organizationId, (tx) => tx.whatsAppCall.update({ where: { id: call.id }, data: { remoteSdp: sdp } }));
  publish(organizationId, call, 'update', { answerSdp: sdp });
}

async function onCallStatus(organizationId: string, externalCallId: string, status: string): Promise<void> {
  const call = await findByExternalId(organizationId, externalCallId);
  if (!call) return deferUntilKnown(externalCallId, () => onCallStatus(organizationId, externalCallId, status));
  if (call.endedAt || call.direction !== 'OUTBOUND') return;
  if (status === 'ACCEPTED' && call.status === 'RINGING') {
    const updated = await withTenant(organizationId, (tx) =>
      tx.whatsAppCall.update({ where: { id: call.id }, data: { status: 'ANSWERED', answeredAt: new Date() }, include: callInclude }),
    );
    publish(organizationId, updated, 'update');
  } else if (status === 'REJECTED') {
    await finalizeCall(organizationId, call.id, 'DECLINED');
  } else if (status === 'RINGING') {
    publish(organizationId, call, 'update', { ringing: true });
  }
}

async function onCallEnded(organizationId: string, externalCallId: string, c: MetaCallEvent): Promise<void> {
  const call = await findByExternalId(organizationId, externalCallId);
  if (!call) return deferUntilKnown(externalCallId, () => onCallEnded(organizationId, externalCallId, c));
  if (call.endedAt) return;
  const talked = call.status === 'ANSWERED' || !!call.answeredAt;
  const failed = String(c.status ?? '').toUpperCase() === 'FAILED';
  const status: CallStatus = talked ? 'COMPLETED' : call.direction === 'INBOUND' ? 'MISSED' : failed ? 'FAILED' : 'NO_ANSWER';
  const duration = Number(c.duration);
  const error = c.errors?.[0];
  await finalizeCall(organizationId, call.id, status, {
    durationSec: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
    errorMessage: failed && error ? friendlyMetaError(error.code, error.message ?? error.title) : null,
  });
}

// --- Agent actions -------------------------------------------------------------

export async function getCall(organizationId: string, viewer: Viewer, callId: string) {
  const call = await loadCall(organizationId, viewer, callId);
  return { ...callDto(call), remoteSdp: call.endedAt ? null : call.remoteSdp };
}

/** Calls ringing right now (for a tab that just opened) and the viewer's own call in progress. */
export async function listActiveCalls(organizationId: string, viewer: Viewer) {
  const rows = await withTenant(organizationId, (tx) =>
    tx.whatsAppCall.findMany({
      where: {
        endedAt: null,
        OR: [
          { direction: 'INBOUND', status: 'RINGING', createdAt: { gt: new Date(Date.now() - RING_TIMEOUT_MS) } },
          { status: 'ANSWERED', OR: [{ answeredById: viewer.userId }, { startedById: viewer.userId }], createdAt: { gt: new Date(Date.now() - STALE_CALL_MS) } },
        ],
      },
      include: callInclude,
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  );
  return rows.filter((c) => canHandle(viewer, c)).map(callDto);
}

export async function acceptCall(organizationId: string, viewer: Viewer, callId: string, sdp: string) {
  const call = await loadCall(organizationId, viewer, callId);
  if (call.direction !== 'INBOUND') throw BadRequest('Only an incoming call can be answered');
  if (call.endedAt) throw Conflict('This call has already ended');
  // First teammate to press Answer gets it — everyone else's ringing stops.
  const claimed = await withTenant(organizationId, (tx) =>
    tx.whatsAppCall.updateMany({ where: { id: callId, status: 'RINGING', answeredById: null, endedAt: null }, data: { answeredById: viewer.userId } }),
  );
  if (!claimed.count) throw Conflict('A teammate already answered this call');

  const creds = await whatsappCredentials(organizationId);
  try {
    await whatsappCallAction(creds.phoneNumberId, creds.accessToken, call.externalCallId, 'pre_accept', sdp);
    await whatsappCallAction(creds.phoneNumberId, creds.accessToken, call.externalCallId, 'accept', sdp);
  } catch (err) {
    await withTenant(organizationId, (tx) => tx.whatsAppCall.updateMany({ where: { id: callId, endedAt: null }, data: { answeredById: null } }));
    throw err;
  }
  const answered = await withTenant(organizationId, (tx) =>
    tx.whatsAppCall.update({ where: { id: callId }, data: { status: 'ANSWERED', answeredAt: new Date() }, include: callInclude }),
  );
  publish(organizationId, answered, 'update');
  return callDto(answered);
}

export async function declineCall(organizationId: string, viewer: Viewer, callId: string) {
  const call = await loadCall(organizationId, viewer, callId);
  if (call.direction !== 'INBOUND' || call.status !== 'RINGING' || call.endedAt) throw Conflict('This call is no longer ringing');
  const creds = await whatsappCredentials(organizationId);
  await whatsappCallAction(creds.phoneNumberId, creds.accessToken, call.externalCallId, 'reject').catch((err) =>
    console.warn('[calls] reject failed:', err instanceof Error ? err.message : err),
  );
  await finalizeCall(organizationId, callId, 'DECLINED', { byUserId: viewer.userId });
}

export async function hangUpCall(organizationId: string, viewer: Viewer, callId: string) {
  const call = await loadCall(organizationId, viewer, callId);
  if (call.endedAt) return;
  if (call.direction === 'INBOUND' && call.status === 'RINGING') return declineCall(organizationId, viewer, callId);
  const creds = await whatsappCredentials(organizationId);
  // Already over on WhatsApp's side (the customer hung up a moment ago) is fine — we're ending it anyway.
  await whatsappCallAction(creds.phoneNumberId, creds.accessToken, call.externalCallId, 'terminate').catch((err) =>
    console.warn('[calls] terminate failed:', err instanceof Error ? err.message : err),
  );
  await finalizeCall(organizationId, callId, call.status === 'ANSWERED' ? 'COMPLETED' : 'NO_ANSWER', { byUserId: viewer.userId });
}

/** The browser couldn't set up audio (no microphone, network blocked…) after the call was placed / answered. */
export async function failCall(organizationId: string, viewer: Viewer, callId: string, reason: string) {
  const call = await loadCall(organizationId, viewer, callId);
  if (call.endedAt) return;
  const creds = await whatsappCredentials(organizationId).catch(() => null);
  if (creds) {
    await whatsappCallAction(creds.phoneNumberId, creds.accessToken, call.externalCallId, call.status === 'RINGING' && call.direction === 'INBOUND' ? 'reject' : 'terminate').catch(
      () => undefined,
    );
  }
  await finalizeCall(organizationId, callId, 'FAILED', { errorMessage: reason.slice(0, 300), byUserId: viewer.userId });
}

export async function startCall(organizationId: string, viewer: Viewer, conversationId: string, sdp: string) {
  await assertConversationVisible(organizationId, viewer, conversationId);
  const conversation = await withTenant(organizationId, async (tx) => {
    const conv = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) throw NotFound('Conversation not found');
    if (conv.channel !== 'WHATSAPP') throw BadRequest('Calls are only available on WhatsApp chats');
    const busy = await tx.whatsAppCall.findFirst({
      where: {
        conversationId,
        endedAt: null,
        OR: [
          { status: 'RINGING', createdAt: { gt: new Date(Date.now() - RING_TIMEOUT_MS) } },
          { status: 'ANSWERED', createdAt: { gt: new Date(Date.now() - STALE_CALL_MS) } },
        ],
      },
    });
    if (busy) throw Conflict('There is already a call going on with this customer');
    return conv;
  });

  const creds = await whatsappCredentials(organizationId);
  let externalCallId: string;
  try {
    externalCallId = await startWhatsAppCall(creds.phoneNumberId, creds.accessToken, conversation.externalContactId, sdp, conversation.id);
  } catch (err) {
    if (metaErrorCode(err) === 138006) {
      throw new AppError(403, 'CALL_PERMISSION_REQUIRED', "This customer hasn't allowed calls from you yet — ask for permission to call first.");
    }
    throw err;
  }
  let call: CallRow;
  try {
    call = await withTenant(organizationId, (tx) =>
      tx.whatsAppCall.create({
        data: { organizationId, conversationId, externalCallId, direction: 'OUTBOUND', status: 'RINGING', startedById: viewer.userId },
        include: callInclude,
      }),
    );
  } catch (err) {
    // WhatsApp is already ringing the customer — don't leave a call nobody can end.
    await whatsappCallAction(creds.phoneNumberId, creds.accessToken, externalCallId, 'terminate').catch(() => undefined);
    throw err;
  }
  scheduleRingTimeout(organizationId, call.id, 'OUTBOUND');
  await runDeferred(externalCallId);
  return callDto(call);
}

// --- Call permission (needed before WE can call a customer) -----------------

export async function getCallPermission(
  organizationId: string,
  viewer: Viewer,
  conversationId: string,
): Promise<WhatsAppCallPermission & { insideWindow: boolean }> {
  await assertConversationVisible(organizationId, viewer, conversationId);
  const conv = await withTenant(organizationId, (tx) => tx.conversation.findUnique({ where: { id: conversationId } }));
  if (!conv || conv.channel !== 'WHATSAPP') throw NotFound('Conversation not found');
  const creds = await whatsappCredentials(organizationId);
  const permission = await getWhatsAppCallPermission(creds.phoneNumberId, creds.accessToken, conv.externalContactId);
  const insideWindow = !!conv.lastInboundAt && Date.now() - conv.lastInboundAt.getTime() < WHATSAPP_WINDOW_MS;
  return { ...permission, insideWindow };
}

export async function requestCallPermission(organizationId: string, viewer: Viewer, conversationId: string, text?: string) {
  await assertConversationVisible(organizationId, viewer, conversationId);
  const { conv, orgName } = await withTenant(organizationId, async (tx) => ({
    conv: await tx.conversation.findUnique({ where: { id: conversationId } }),
    orgName: (await tx.organization.findUnique({ where: { id: organizationId }, select: { name: true } }))?.name ?? 'us',
  }));
  if (!conv || conv.channel !== 'WHATSAPP') throw NotFound('Conversation not found');
  if (!conv.lastInboundAt || Date.now() - conv.lastInboundAt.getTime() > WHATSAPP_WINDOW_MS) {
    throw BadRequest(
      "It's been more than 24 hours since this customer's last message, so WhatsApp won't deliver a call request now. Send them a template first — once they reply, you can ask.",
    );
  }
  const body = (text?.trim() || `Hi! ${orgName} would like to call you on WhatsApp about your trip. Is that okay?`).slice(0, 1024);
  const creds = await whatsappCredentials(organizationId);
  const wamid = await sendWhatsAppCallPermissionRequest(creds.phoneNumberId, creds.accessToken, conv.externalContactId, body);
  const note = '📞 Asked to allow WhatsApp calls';
  return withTenant(organizationId, async (tx) => {
    const message = await tx.message.create({
      data: { organizationId, conversationId, direction: 'OUTBOUND', body: `${note}\n${body}`, externalMessageId: wamid, status: 'SENT', sentById: viewer.userId },
    });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date(), lastMessagePreview: note } });
    return message;
  });
}

/** What the customer's answer to "Allow calls?" looks like in the chat (bracketed: the bots let it pass silently). */
export function callPermissionReplyBody(reply: { response?: string; is_permanent?: boolean; expiration_timestamp?: number }): string {
  if (reply.response !== 'accept') return '[📞 Declined WhatsApp calls]';
  if (reply.is_permanent) return '[📞 Allowed WhatsApp calls — always]';
  const until = reply.expiration_timestamp
    ? new Date(reply.expiration_timestamp * 1000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
    : null;
  return `[📞 Allowed WhatsApp calls${until ? ` — until ${until}` : ' — for 7 days'}]`;
}

// --- Settings (admin) ---------------------------------------------------------------

export async function getCallingSettings(organizationId: string): Promise<WhatsAppCallingSettings> {
  const creds = await whatsappCredentials(organizationId);
  return getWhatsAppCallingSettings(creds.phoneNumberId, creds.accessToken);
}

export async function updateCallingSettings(organizationId: string, input: WhatsAppCallingSettings): Promise<WhatsAppCallingSettings> {
  const creds = await whatsappCredentials(organizationId);
  await updateWhatsAppCallingSettings(creds.phoneNumberId, creds.accessToken, input);
  return getWhatsAppCallingSettings(creds.phoneNumberId, creds.accessToken).catch(() => input);
}
