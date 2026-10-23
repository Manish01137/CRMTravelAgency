import type { Prisma } from '@prisma/client';
import { withTenant } from '../../lib/prisma';
import { decryptJson } from '../../lib/encryption';
import {
  sendWhatsAppText,
  sendWhatsAppImage,
  sendWhatsAppDocument,
  sendWhatsAppTemplate,
  templateBodyVariables,
  sendInstagramText,
  sendInstagramImage,
  createWhatsAppTemplate,
  metaErrorText,
} from '../../lib/meta';
import { AppError, BadRequest, NotFound } from '../../lib/errors';
import type { WhatsAppCredentials, InstagramCredentials } from '../channels/channels.service';
import { LEAD_STAGES, type CreateTemplateInput, type ListConversationsQuery, type SendMessageInput, type StageCountsQuery } from './inbox.schemas';

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Instagram: a normal reply within 24h of their last message; a team member's reply (HUMAN_AGENT tag) within 7 days. */
const INSTAGRAM_WINDOW_MS = 24 * 60 * 60 * 1000;
const INSTAGRAM_HUMAN_AGENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const INSTAGRAM_WINDOW_HELP =
  "Instagram only allows replies within 24 hours of the customer's last message (up to 7 days for a team member's reply, if your Meta app has the Human Agent feature). Ask them to message you again — then you can reply.";


/** The chat's lead as the Inbox shows it: stage, tags and who it's assigned to. */
const CONVERSATION_LEAD_SELECT = {
  id: true,
  status: true,
  tags: true,
  assignedToId: true,
  assignedTo: { select: { id: true, name: true } },
} as const;

/** Instagram's own "sent outside of allowed window" error, in words the agent can act on. */
function explainInstagramWindow(err: unknown): never {
  if (err instanceof Error && /allowed window|outside.*window|human.?agent/i.test(`${metaErrorText(err)} ${err.message}`)) throw BadRequest(INSTAGRAM_WINDOW_HELP);
  throw err;
}

/** There's no separate "media kind" column on Message — a document attachment
 *  is just a mediaUrl that happens to end in .pdf, same as everything else
 *  here trusting the URL (see PackageBrochurePage's own dayPhoto/heroPhoto). */
const isPdfUrl = (url: string) => /\.pdf(?:[?#]|$)/i.test(url);

/** Recovers the human filename embedded by uploadBufferToStorage's document
 *  upload (see storage.ts) — the URL's last path segment, minus the
 *  "<timestamp>-<random>-" prefix every upload key gets. */
function documentFilenameFromUrl(url: string): string {
  const last = url.split('/').pop() ?? 'document.pdf';
  const withoutQuery = last.split(/[?#]/)[0];
  return withoutQuery.replace(/^\d+-[0-9a-f]+-/, '') || 'document.pdf';
}

/**
 * Inbox filter chips: "all" (default), "unread" (unreadCount > 0, already
 * tracked on every conversation), "favorites" (isFavorite, toggled via
 * setFavorite below). No "group" chip — the WhatsApp Cloud API a business
 * connects here doesn't support group messaging at all (it's built for 1:1
 * business-to-customer conversations only), so there would never be any
 * group conversations to show; a chip for it would just always be empty.
 */
export async function listConversations(
  organizationId: string,
  query: ListConversationsQuery,
  userId: string,
  scope: Prisma.ConversationWhereInput = {},
) {
  return withTenant(organizationId, (tx) =>
    tx.conversation.findMany({
      where: {
        organizationId,
        // `scope`: which chats this user may see at all (lib/visibility.ts).
        AND: [scope, ...(query.filter === 'unassigned' ? [{ OR: [{ leadId: null }, { lead: { assignedToId: null } }] }] : [])],
        channel: query.channel,
        ...(query.filter === 'unread' ? { unreadCount: { gt: 0 } } : {}),
        ...(query.filter === 'favorites' ? { isFavorite: true } : {}),
        ...(query.filter === 'mine' ? { lead: { assignedToId: userId } } : {}),
        ...(query.stage === 'none' ? { leadId: null } : query.stage ? { lead: { status: query.stage } } : {}),
        ...(query.search
          ? {
              OR: [
                { contactName: { contains: query.search, mode: 'insensitive' } },
                { contactPhone: { contains: query.search } },
              ],
            }
          : {}),
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
      include: { lead: { select: CONVERSATION_LEAD_SELECT } },
    }),
  );
}

/** How many chats on this channel sit in each lead stage — the counts on the Inbox stage chips. */
export async function stageCounts(organizationId: string, query: StageCountsQuery, scope: Prisma.ConversationWhereInput = {}) {
  return withTenant(organizationId, async (tx) => {
    // Sequential — an interactive transaction uses one connection.
    const grouped = await tx.lead.groupBy({
      by: ['status'],
      where: { organizationId, conversations: { some: { channel: query.channel, ...scope } } },
      _count: { _all: true },
    });
    const total = await tx.conversation.count({ where: { organizationId, channel: query.channel, AND: [scope] } });
    const noLead = await tx.conversation.count({ where: { organizationId, channel: query.channel, leadId: null, AND: [scope] } });
    const byStage = Object.fromEntries(LEAD_STAGES.map((s) => [s, 0])) as Record<(typeof LEAD_STAGES)[number], number>;
    for (const g of grouped) byStage[g.status] = g._count._all;
    return { total, none: noLead, byStage };
  });
}

export async function setFavorite(organizationId: string, conversationId: string, isFavorite: boolean) {
  return withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw NotFound('Conversation not found');
    return tx.conversation.update({ where: { id: conversationId }, data: { isFavorite } });
  });
}

export async function listMessages(organizationId: string, conversationId: string) {
  return withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw NotFound('Conversation not found');
    const messages = await tx.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' }, take: 500 });
    const lead = conversation.leadId ? await tx.lead.findUnique({ where: { id: conversation.leadId }, select: CONVERSATION_LEAD_SELECT }) : null;
    if (conversation.unreadCount > 0) {
      await tx.conversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } });
    }
    return { conversation: { ...conversation, lead }, messages };
  });
}

/** What phase 1 hands to the Meta call — everything it needs, so the send itself touches no database. */
type SendPlan =
  | { channel: 'WHATSAPP'; creds: WhatsAppCredentials; to: string; template: { name: string; language: string; params: string[]; paramNames: (string | null)[] } | null }
  | { channel: 'INSTAGRAM'; creds: InstagramCredentials; to: string; humanAgent: boolean };

/**
 * Sends an agent's message in three steps, with the network call to Meta in
 * none of the database transactions (a slow database used to let the
 * transaction expire AFTER Meta had delivered the message — the customer got
 * it, the agent saw "Something went wrong" and no bubble):
 *   1. a short transaction checks the chat and saves the message as QUEUED;
 *   2. Meta is called, outside any transaction;
 *   3. a short transaction marks it SENT (with Meta's message id) or FAILED
 *      (with the reason). A failed send never removes the message row.
 * A send is never retried automatically — that could deliver it twice.
 */
export async function sendMessage(
  organizationId: string,
  conversationId: string,
  userId: string,
  input: SendMessageInput,
) {
  // --- 1. checks + QUEUED message -------------------------------------------
  const { message: queued, plan } = await withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw NotFound('Conversation not found');

    const connection = await tx.channelConnection.findUnique({
      where: { organizationId_channel: { organizationId, channel: conversation.channel } },
    });
    if (!connection || connection.status !== 'CONNECTED' || !connection.credentials) {
      throw BadRequest(`${conversation.channel === 'WHATSAPP' ? 'WhatsApp' : 'Instagram'} is not connected`);
    }

    const outsideWindow =
      conversation.channel === 'WHATSAPP' &&
      (!conversation.lastInboundAt || Date.now() - conversation.lastInboundAt.getTime() > WHATSAPP_WINDOW_MS);

    if (outsideWindow && !input.templateName) {
      throw BadRequest('This conversation is outside the 24-hour window — send an approved template instead');
    }

    // Instagram has no templates: past 24h only a team member's reply (HUMAN_AGENT tag) is allowed, for 7 days.
    const igSinceInbound = conversation.lastInboundAt ? Date.now() - conversation.lastInboundAt.getTime() : Infinity;
    if (conversation.channel === 'INSTAGRAM' && igSinceInbound > INSTAGRAM_HUMAN_AGENT_WINDOW_MS) {
      throw BadRequest(INSTAGRAM_WINDOW_HELP);
    }
    if (conversation.channel === 'INSTAGRAM' && input.mediaUrl && isPdfUrl(input.mediaUrl)) {
      throw BadRequest('Instagram DMs only support photos, not documents');
    }

    let plan: SendPlan;
    if (conversation.channel === 'WHATSAPP') {
      let template: Extract<SendPlan, { channel: 'WHATSAPP' }>['template'] = null;
      if (input.templateName) {
        const row = await tx.messageTemplate.findFirst({ where: { organizationId, name: input.templateName, status: 'APPROVED' } });
        if (!row) throw BadRequest('That template was not found or is not yet approved');
        // Fill the template's variables: the first one is the contact's name.
        // Other values aren't guessed — a template needing more is refused.
        const variables = templateBodyVariables(row.bodyText);
        if (variables.length > 1) {
          throw BadRequest(`This template needs ${variables.length} values; only the contact name is supported right now`);
        }
        template = {
          name: row.name,
          language: row.language,
          params: variables.length === 1 ? [conversation.contactName?.trim() || 'there'] : [],
          paramNames: variables.map((v) => (v.named ? v.key : null)),
        };
      }
      plan = { channel: 'WHATSAPP', creds: decryptJson<WhatsAppCredentials>(connection.credentials), to: conversation.externalContactId, template };
    } else {
      plan = {
        channel: 'INSTAGRAM',
        creds: decryptJson<InstagramCredentials>(connection.credentials),
        to: conversation.externalContactId,
        humanAgent: igSinceInbound > INSTAGRAM_WINDOW_MS,
      };
    }

    const preview = input.mediaUrl ? (input.body?.trim() ? input.body : '📷 Photo') : (input.body ?? '');
    const message = await tx.message.create({
      data: {
        organizationId,
        conversationId,
        direction: 'OUTBOUND',
        body: input.body || null,
        mediaUrl: input.mediaUrl,
        templateName: input.templateName,
        status: 'QUEUED',
        sentById: userId,
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), lastMessagePreview: preview.slice(0, 200) },
    });
    return { message, plan };
  });

  // --- 2. Meta, outside any transaction --------------------------------------
  let externalMessageId: string;
  try {
    externalMessageId = (await sendThroughMeta(plan, input).catch(asSendError)).externalMessageId;
  } catch (err) {
    // The real reason belongs in the server logs too, not only on the message.
    console.error('[inbox] send failed', { messageId: queued.id, error: err instanceof Error ? err.message : err });
    // --- 3a. FAILED, with the reason (already in plain words — lib/metaErrors.ts)
    const errorMessage = (err instanceof Error ? err.message : 'Send failed').slice(0, 1000);
    await withTenant(organizationId, (tx) => tx.message.update({ where: { id: queued.id }, data: { status: 'FAILED', errorMessage } })).catch(
      (saveErr) => console.error('[inbox] could not mark the message FAILED', { messageId: queued.id, error: saveErr instanceof Error ? saveErr.message : saveErr }),
    );
    throw err;
  }

  // --- 3b. SENT + Meta's message id (the delivery / read webhooks find it by this id)
  const markSent = () =>
    withTenant(organizationId, (tx) => tx.message.update({ where: { id: queued.id }, data: { status: 'SENT', externalMessageId } }));
  try {
    return await markSent();
  } catch (firstErr) {
    console.error('[inbox] message sent but saving it failed — retrying once', {
      messageId: queued.id,
      wamid: externalMessageId,
      error: firstErr instanceof Error ? firstErr.message : firstErr,
    });
    try {
      await new Promise((r) => setTimeout(r, 1000));
      return await markSent();
    } catch (secondErr) {
      // Meta delivered it — never show the agent an error for a message the customer has.
      console.error('[inbox] message sent but could not be saved as SENT', {
        messageId: queued.id,
        wamid: externalMessageId,
        error: secondErr instanceof Error ? secondErr.message : secondErr,
      });
      return { ...queued, status: 'SENT' as const, externalMessageId };
    }
  }
}

/** Anything that isn't already one of our errors (e.g. an odd Meta reply) — in words, not a bare 500. */
function asSendError(err: unknown): never {
  if (err instanceof AppError) throw err;
  console.error('[inbox] unexpected send error', err);
  throw new AppError(502, 'SEND_FAILED', "Meta gave an unexpected reply, so this message may not have been sent — check WhatsApp/Instagram before sending it again.");
}

/** The one network call of a send — no database access in here. */
async function sendThroughMeta(plan: SendPlan, input: SendMessageInput): Promise<{ externalMessageId: string }> {
  if (plan.channel === 'WHATSAPP') {
    const { creds, to, template } = plan;
    if (template) {
      return sendWhatsAppTemplate(creds.phoneNumberId, creds.accessToken, to, template.name, template.language, template.params, template.paramNames);
    }
    if (input.mediaUrl && isPdfUrl(input.mediaUrl)) {
      return sendWhatsAppDocument(creds.phoneNumberId, creds.accessToken, to, input.mediaUrl, documentFilenameFromUrl(input.mediaUrl), input.body?.trim() || undefined);
    }
    if (input.mediaUrl) {
      // WhatsApp supports a caption on the image itself — one message, not two.
      return sendWhatsAppImage(creds.phoneNumberId, creds.accessToken, to, input.mediaUrl, input.body?.trim() || undefined);
    }
    return sendWhatsAppText(creds.phoneNumberId, creds.accessToken, to, input.body!);
  }
  const { creds, to, humanAgent } = plan;
  // Instagram's attachment message has no caption field — any typed text
  // alongside a photo is dropped rather than silently sent as a separate,
  // unlabeled second message.
  if (input.mediaUrl) return sendInstagramImage(creds.igUserId, creds.accessToken, to, input.mediaUrl, { humanAgent }).catch(explainInstagramWindow);
  return sendInstagramText(creds.igUserId, creds.accessToken, to, input.body!, { humanAgent }).catch(explainInstagramWindow);
}

/**
 * Logs a phone call as a touchpoint on the conversation — the WhatsApp/
 * Instagram Business APIs have no calling capability at all (only the
 * customer's own WhatsApp app can place a call), so the frontend's "Call"
 * button just opens a tel: link to dial the agent's own phone. This records
 * that it happened, as a plain local note — never sent through Meta.
 */
export async function logCall(organizationId: string, conversationId: string, userId: string) {
  return withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw NotFound('Conversation not found');

    const preview = '📞 Called';
    const message = await tx.message.create({
      data: { organizationId, conversationId, direction: 'OUTBOUND', body: preview, status: 'SENT', sentById: userId },
    });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date(), lastMessagePreview: preview } });
    return message;
  });
}

export async function listTemplates(organizationId: string) {
  return withTenant(organizationId, (tx) => tx.messageTemplate.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } }));
}

export async function createTemplate(organizationId: string, input: CreateTemplateInput) {
  return withTenant(organizationId, async (tx) => {
    const connection = await tx.channelConnection.findUnique({
      where: { organizationId_channel: { organizationId, channel: 'WHATSAPP' } },
    });
    if (!connection || connection.status !== 'CONNECTED' || !connection.credentials || !connection.externalId) {
      throw BadRequest('Connect WhatsApp before creating templates');
    }
    const creds = decryptJson<WhatsAppCredentials>(connection.credentials);
    const { externalTemplateId } = await createWhatsAppTemplate(connection.externalId, creds.accessToken, {
      name: input.name,
      category: input.category,
      language: input.language,
      bodyText: input.bodyText,
      bodyExamples: input.bodyExamples,
    });
    return tx.messageTemplate.create({
      data: {
        organizationId,
        name: input.name,
        category: input.category,
        language: input.language,
        bodyText: input.bodyText,
        externalTemplateId,
        status: 'PENDING',
      },
    });
  });
}
