import { withTenant } from '../../lib/prisma';
import { decryptJson } from '../../lib/encryption';
import { sendEmail } from '../../lib/resend';
import { sendWhatsAppText, sendInstagramText } from '../../lib/meta';
import type { EmailCredentials, WhatsAppCredentials, InstagramCredentials } from '../channels/channels.service';

/**
 * Follow-up nudge sweep — channel-agnostic by design. Runs periodically (see
 * queues/automation-sweep.ts): for each org with automation enabled, finds
 * open leads that have gone quiet past `delayHours` and haven't already been
 * nudged for this staleness window, then sends one nudge via whichever
 * channel is actually eligible (WhatsApp inside its 24h window > Instagram >
 * Email). Fully testable today via Email; identical code path once an org's
 * WhatsApp connection is live for real.
 *
 * Every external send call runs OUTSIDE a `withTenant` transaction — a slow/
 * unreachable provider must never hold a DB transaction open (Prisma's
 * interactive-transaction timeout is short; found and fixed during Phase 4's
 * own end-to-end testing). Each lead gets its own short read transaction,
 * then an untransacted send, then its own short write transaction.
 */

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

interface LeadRow {
  id: string;
  email: string | null;
  status: string;
  updatedAt: Date;
}

async function lastActivityAt(organizationId: string, leadId: string): Promise<Date> {
  return withTenant(organizationId, async (tx) => {
    const [lead, log, message] = await Promise.all([
      tx.lead.findUnique({ where: { id: leadId }, select: { updatedAt: true } }),
      tx.communicationLog.findFirst({ where: { organizationId, leadId }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      tx.message.findFirst({ where: { organizationId, conversation: { leadId } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);
    const times = [lead?.updatedAt, log?.createdAt, message?.createdAt].filter((d): d is Date => !!d);
    return times.length ? new Date(Math.max(...times.map((d) => d.getTime()))) : new Date(0);
  });
}

async function alreadyNudgedSince(organizationId: string, leadId: string, since: Date): Promise<boolean> {
  return withTenant(organizationId, async (tx) => {
    const existing = await tx.followUpAttempt.findFirst({
      where: { organizationId, leadId, status: { in: ['SENT', 'SKIPPED'] }, scheduledFor: { gte: since } },
    });
    return !!existing;
  });
}

type Target =
  | { via: 'WHATSAPP'; conversationId: string; externalContactId: string; accessToken: string; phoneNumberId: string }
  | { via: 'INSTAGRAM'; conversationId: string; externalContactId: string; accessToken: string; igUserId: string }
  | { via: 'EMAIL'; apiKey: string; fromAddress: string; toAddress: string }
  | { via: 'NONE'; reason: string };

/** A stored credential can be undecryptable (ENCRYPTION_KEY rotated, corrupt
 *  row) — that must fall through to the next channel option, never throw and
 *  abandon the whole lead (found during Phase 4's own end-to-end testing). */
function safeDecrypt<T>(payload: string): T | null {
  try {
    return decryptJson<T>(payload);
  } catch {
    return null;
  }
}

/** Fast, read-only: figures out WHERE to send, without sending anything yet. */
async function resolveTarget(organizationId: string, lead: LeadRow): Promise<Target> {
  return withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findFirst({ where: { organizationId, leadId: lead.id }, orderBy: { lastMessageAt: 'desc' } });

    if (conversation && (conversation.channel === 'WHATSAPP' || conversation.channel === 'INSTAGRAM')) {
      const connection = await tx.channelConnection.findUnique({ where: { organizationId_channel: { organizationId, channel: conversation.channel } } });
      const withinWindow = conversation.channel === 'INSTAGRAM' || (!!conversation.lastInboundAt && Date.now() - conversation.lastInboundAt.getTime() <= WHATSAPP_WINDOW_MS);

      if (connection?.status === 'CONNECTED' && connection.credentials && withinWindow) {
        if (conversation.channel === 'WHATSAPP') {
          const creds = safeDecrypt<WhatsAppCredentials>(connection.credentials);
          if (creds) return { via: 'WHATSAPP', conversationId: conversation.id, externalContactId: conversation.externalContactId, accessToken: creds.accessToken, phoneNumberId: creds.phoneNumberId };
        } else {
          const creds = safeDecrypt<InstagramCredentials>(connection.credentials);
          if (creds) return { via: 'INSTAGRAM', conversationId: conversation.id, externalContactId: conversation.externalContactId, accessToken: creds.accessToken, igUserId: creds.igUserId };
        }
      }
    }

    if (lead.email) {
      const emailConnection = await tx.channelConnection.findUnique({ where: { organizationId_channel: { organizationId, channel: 'EMAIL' } } });
      if (emailConnection?.status === 'CONNECTED' && emailConnection.credentials) {
        const creds = safeDecrypt<EmailCredentials>(emailConnection.credentials);
        if (creds) return { via: 'EMAIL', apiKey: creds.apiKey, fromAddress: creds.fromAddress, toAddress: lead.email };
      }
    }

    return { via: 'NONE', reason: 'No connected channel eligible for this lead (no email, and no WhatsApp/Instagram conversation within window)' };
  });
}

interface SendOutcome {
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  reason?: string;
}

/** The actual external call — no open transaction here. */
async function sendVia(target: Target, message: string): Promise<SendOutcome> {
  try {
    if (target.via === 'WHATSAPP') {
      await sendWhatsAppText(target.phoneNumberId, target.accessToken, target.externalContactId, message);
      return { status: 'SENT' };
    }
    if (target.via === 'INSTAGRAM') {
      await sendInstagramText(target.igUserId, target.accessToken, target.externalContactId, message);
      return { status: 'SENT' };
    }
    if (target.via === 'EMAIL') {
      await sendEmail(target.apiKey, { from: target.fromAddress, to: target.toAddress, subject: 'Still thinking about your trip?', text: message });
      return { status: 'SENT' };
    }
    return { status: 'SKIPPED', reason: target.reason };
  } catch (err) {
    return { status: 'FAILED', reason: err instanceof Error ? err.message : 'Send failed' };
  }
}

/** Fast write-only: records the result (Message/CommunicationLog + FollowUpAttempt). */
async function recordOutcome(organizationId: string, leadId: string, target: Target, message: string, outcome: SendOutcome, scheduledFor: Date): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    if (outcome.status === 'SENT' && (target.via === 'WHATSAPP' || target.via === 'INSTAGRAM')) {
      await tx.message.create({ data: { organizationId, conversationId: target.conversationId, direction: 'OUTBOUND', body: message, status: 'SENT', sentById: null } });
      await tx.conversation.update({ where: { id: target.conversationId }, data: { lastMessageAt: new Date(), lastMessagePreview: message.slice(0, 200) } });
    } else if (outcome.status === 'SENT' && target.via === 'EMAIL') {
      await tx.communicationLog.create({
        data: { organizationId, leadId, channel: 'EMAIL', toAddress: target.toAddress, subject: 'Still thinking about your trip?', body: message, status: 'SENT', sentById: null },
      });
    }
    await tx.followUpAttempt.create({
      data: { organizationId, leadId, channel: target.via, scheduledFor, status: outcome.status, reason: outcome.reason },
    });
  });
}

/** Runs the sweep for ONE organization. Called by queues/automation-sweep.ts across every org with automation enabled. */
export async function sweepOrganization(organizationId: string): Promise<void> {
  const settings = await withTenant(organizationId, (tx) => tx.automationSettings.findUnique({ where: { organizationId } }));
  if (!settings?.enabled) return;

  const thresholdMs = settings.delayHours * 60 * 60 * 1000;
  const nudgeMessage = settings.nudgeMessage?.trim() || "Just checking in — happy to help if you still have questions about your trip! Let us know.";

  const leads = await withTenant(organizationId, (tx) =>
    tx.lead.findMany({ where: { organizationId, status: { notIn: ['WON', 'LOST'] } }, select: { id: true, email: true, status: true, updatedAt: true }, take: 500 }),
  );

  for (const lead of leads) {
    try {
      const last = await lastActivityAt(organizationId, lead.id);
      if (Date.now() - last.getTime() < thresholdMs) continue;
      if (await alreadyNudgedSince(organizationId, lead.id, last)) continue;

      const target = await resolveTarget(organizationId, lead);
      const outcome = await sendVia(target, nudgeMessage);
      await recordOutcome(organizationId, lead.id, target, nudgeMessage, outcome, new Date());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Automation sweep: failed for lead', lead.id, err instanceof Error ? err.message : err);
    }
  }
}
