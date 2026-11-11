import type { Prisma, ScheduledMessage } from '@prisma/client';
import { systemPrisma, withTenant } from '../../lib/prisma';
import { AppError, BadRequest, NotFound } from '../../lib/errors';
import { contactBody, locationBody, richPreview } from '../../lib/richMessages';
import { sendMessage } from './inbox.service';
import type { SendMessageInput } from './inbox.schemas';

/**
 * Messages scheduled for later (Inbox → Schedule). Each is stored with the
 * exact fields of a normal send; at its time the worker
 * (queues/scheduled-messages.ts) sends it through inbox.service's sendMessage,
 * as the teammate who scheduled it — same checks, same FAILED reasons.
 */

const MIN_LEAD_MS = 60 * 1000;
const MAX_AHEAD_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
const MAX_PENDING_PER_CHAT = 20;
/** A send this late (the server was down at its time) isn't sent — it may no longer make sense. */
const MAX_LATE_MS = 6 * 60 * 60 * 1000;
/** A send that never finished (the server restarted mid-send). */
const STUCK_MS = 10 * 60 * 1000;

const SELECT = {
  id: true,
  sendAt: true,
  preview: true,
  status: true,
  errorMessage: true,
  payload: true,
  messageId: true,
  sentAt: true,
  createdAt: true,
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.ScheduledMessageSelect;

const DOCUMENT = /\.(pdf|docx?|xlsx?|pptx?|txt|csv)(?:[?#]|$)/i;
const VIDEO = /\.(mp4|3gp|mov|webm)(?:[?#]|$)/i;

/** One line for the list. */
function previewOf(input: SendMessageInput): string {
  if (input.templateName) return `Template · ${input.templateName}`;
  if (input.location) return richPreview(locationBody(input.location)) ?? '📍 Location';
  if (input.contact) return richPreview(contactBody([{ name: input.contact.name, phones: [input.contact.phone] }])) ?? '👤 Contact';
  const text = input.body?.trim() ?? '';
  if (input.mediaUrl) {
    const kind = DOCUMENT.test(input.mediaUrl) ? '📄 Document' : VIDEO.test(input.mediaUrl) ? '🎥 Video' : '📷 Photo';
    return text ? `${kind} · ${text}` : kind;
  }
  return text;
}

function checkTime(sendAt: Date) {
  const ahead = sendAt.getTime() - Date.now();
  if (Number.isNaN(ahead)) throw BadRequest('Pick a date and time');
  if (ahead < MIN_LEAD_MS) throw BadRequest('Pick a time at least a minute from now');
  if (ahead > MAX_AHEAD_MS) throw BadRequest('Messages can be scheduled up to 60 days ahead');
}

export async function scheduleMessage(organizationId: string, conversationId: string, userId: string, sendAt: Date, input: SendMessageInput) {
  checkTime(sendAt);
  // Replies quote a message by its place in the chat as it is now — a later send goes in as a normal message.
  const { replyToMessageId: _reply, ...payload } = input;
  return withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId }, select: { channel: true } });
    if (!conversation) throw NotFound('Conversation not found');
    if (conversation.channel === 'INSTAGRAM' && (payload.location || payload.contact || payload.templateName)) {
      throw BadRequest('Locations, contacts and templates can be scheduled on WhatsApp chats');
    }
    if (conversation.channel === 'INSTAGRAM' && payload.mediaUrl && (DOCUMENT.test(payload.mediaUrl) || VIDEO.test(payload.mediaUrl))) {
      throw BadRequest('From the CRM, Instagram DMs can only send photos');
    }
    const pending = await tx.scheduledMessage.count({ where: { conversationId, status: 'PENDING' } });
    if (pending >= MAX_PENDING_PER_CHAT) throw BadRequest(`A chat can have up to ${MAX_PENDING_PER_CHAT} scheduled messages`);
    return tx.scheduledMessage.create({
      data: { organizationId, conversationId, createdById: userId, sendAt, payload: payload as Prisma.InputJsonValue, preview: previewOf(payload).slice(0, 500) },
      select: SELECT,
    });
  });
}

/** Waiting ones, plus ones that failed in the last week (until dismissed). */
export async function listScheduled(organizationId: string, conversationId: string) {
  return withTenant(organizationId, (tx) =>
    tx.scheduledMessage.findMany({
      where: {
        conversationId,
        OR: [{ status: { in: ['PENDING', 'SENDING'] } }, { status: 'FAILED', updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }],
      },
      orderBy: { sendAt: 'asc' },
      take: 50,
      select: SELECT,
    }),
  );
}

async function findOwn(tx: Prisma.TransactionClient, conversationId: string, id: string) {
  const row = await tx.scheduledMessage.findFirst({ where: { id, conversationId }, select: { id: true, status: true, payload: true } });
  if (!row) throw NotFound('Scheduled message not found');
  return row;
}

/** New time and/or new text (text-only messages). */
export async function updateScheduled(organizationId: string, conversationId: string, id: string, change: { sendAt?: Date; body?: string }) {
  if (change.sendAt) checkTime(change.sendAt);
  return withTenant(organizationId, async (tx) => {
    const row = await findOwn(tx, conversationId, id);
    if (row.status !== 'PENDING' && row.status !== 'FAILED') throw BadRequest('This message has already been sent');
    const payload = row.payload as SendMessageInput;
    const data: Prisma.ScheduledMessageUpdateInput = {};
    if (change.sendAt) data.sendAt = change.sendAt;
    if (change.body !== undefined) {
      if (payload.templateName || payload.location || payload.contact) throw BadRequest("This message's text can't be edited");
      const next = { ...payload, body: change.body };
      data.payload = next as Prisma.InputJsonValue;
      data.preview = previewOf(next).slice(0, 500);
    }
    // A failed one given a new time is waiting again.
    if (row.status === 'FAILED') {
      if (!change.sendAt) throw BadRequest('Pick a new time to schedule it again');
      Object.assign(data, { status: 'PENDING', errorMessage: null });
    }
    return tx.scheduledMessage.update({ where: { id }, data, select: SELECT });
  });
}

/** Cancel a waiting one, or dismiss a failed one. */
export async function cancelScheduled(organizationId: string, conversationId: string, id: string) {
  return withTenant(organizationId, async (tx) => {
    const row = await findOwn(tx, conversationId, id);
    if (row.status !== 'PENDING' && row.status !== 'FAILED') throw BadRequest('This message is already being sent');
    await tx.scheduledMessage.update({ where: { id }, data: { status: 'CANCELLED' } });
    return { ok: true };
  });
}

/** "Send now": claim it so the worker can't send it too, then send. */
export async function sendScheduledNow(organizationId: string, conversationId: string, id: string) {
  await withTenant(organizationId, (tx) => findOwn(tx, conversationId, id));
  const claimed = await systemPrisma.scheduledMessage.updateMany({ where: { id, organizationId, status: { in: ['PENDING', 'FAILED'] } }, data: { status: 'SENDING' } });
  if (claimed.count === 0) throw BadRequest('This message is already being sent');
  const row = await systemPrisma.scheduledMessage.findUniqueOrThrow({ where: { id } });
  const result = await deliver(row);
  if (result.error) throw new AppError(502, 'SCHEDULED_SEND_FAILED', result.error);
  return { ok: true, messageId: result.messageId };
}

async function deliver(row: ScheduledMessage): Promise<{ messageId?: string; error?: string }> {
  const fail = async (error: string) => {
    await systemPrisma.scheduledMessage.update({ where: { id: row.id }, data: { status: 'FAILED', errorMessage: error.slice(0, 1000) } });
    return { error };
  };
  if (!row.createdById) return fail('The teammate who scheduled this no longer has an account — send it again yourself');
  try {
    const message = await sendMessage(row.organizationId, row.conversationId, row.createdById, row.payload as SendMessageInput);
    await systemPrisma.scheduledMessage.update({ where: { id: row.id }, data: { status: 'SENT', sentAt: new Date(), messageId: message.id, errorMessage: null } });
    return { messageId: message.id };
  } catch (err) {
    return fail(err instanceof AppError || err instanceof Error ? err.message : 'Could not send');
  }
}

/** One worker pass: send everything that's due (oldest first). */
export async function runDueScheduledMessages(): Promise<number> {
  const now = Date.now();
  await systemPrisma.scheduledMessage.updateMany({
    where: { status: 'SENDING', updatedAt: { lt: new Date(now - STUCK_MS) } },
    data: { status: 'FAILED', errorMessage: 'Sending was interrupted — check the chat, and send it again if it isn’t there' },
  });
  const due = await systemPrisma.scheduledMessage.findMany({
    where: { status: 'PENDING', sendAt: { lte: new Date(now) } },
    orderBy: { sendAt: 'asc' },
    take: 25,
  });
  let sent = 0;
  for (const row of due) {
    // Claim first — two servers (or "Send now") never send the same one twice.
    const claimed = await systemPrisma.scheduledMessage.updateMany({ where: { id: row.id, status: 'PENDING' }, data: { status: 'SENDING' } });
    if (claimed.count === 0) continue;
    if (now - row.sendAt.getTime() > MAX_LATE_MS) {
      await systemPrisma.scheduledMessage.update({
        where: { id: row.id },
        data: { status: 'FAILED', errorMessage: 'Not sent — it was more than 6 hours late (the server was unavailable at its time)' },
      });
      continue;
    }
    if (!(await deliver(row)).error) sent++;
  }
  return sent;
}
