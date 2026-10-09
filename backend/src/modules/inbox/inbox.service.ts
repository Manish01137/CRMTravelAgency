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
} from '../../lib/meta';
import { BadRequest, NotFound } from '../../lib/errors';
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
  if (err instanceof Error && /allowed window|outside.*window|human.?agent/i.test(err.message)) throw BadRequest(INSTAGRAM_WINDOW_HELP);
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
export async function listConversations(organizationId: string, query: ListConversationsQuery, userId: string) {
  return withTenant(organizationId, (tx) =>
    tx.conversation.findMany({
      where: {
        organizationId,
        channel: query.channel,
        ...(query.filter === 'unread' ? { unreadCount: { gt: 0 } } : {}),
        ...(query.filter === 'favorites' ? { isFavorite: true } : {}),
        ...(query.filter === 'mine' ? { lead: { assignedToId: userId } } : {}),
        ...(query.filter === 'unassigned' ? { AND: [{ OR: [{ leadId: null }, { lead: { assignedToId: null } }] }] } : {}),
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
export async function stageCounts(organizationId: string, query: StageCountsQuery) {
  return withTenant(organizationId, async (tx) => {
    // Sequential — an interactive transaction uses one connection.
    const grouped = await tx.lead.groupBy({
      by: ['status'],
      where: { organizationId, conversations: { some: { channel: query.channel } } },
      _count: { _all: true },
    });
    const total = await tx.conversation.count({ where: { organizationId, channel: query.channel } });
    const noLead = await tx.conversation.count({ where: { organizationId, channel: query.channel, leadId: null } });
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

export async function sendMessage(
  organizationId: string,
  conversationId: string,
  userId: string,
  input: SendMessageInput,
) {
  return withTenant(organizationId, async (tx) => {
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
    const igOptions = { humanAgent: conversation.channel === 'INSTAGRAM' && igSinceInbound > INSTAGRAM_WINDOW_MS };

    const preview = input.mediaUrl ? (input.body?.trim() ? input.body : '📷 Photo') : (input.body ?? '');

    try {
      let externalMessageId: string;
      if (conversation.channel === 'WHATSAPP') {
        const creds = decryptJson<WhatsAppCredentials>(connection.credentials);
        if (input.templateName) {
          const template = await tx.messageTemplate.findFirst({
            where: { organizationId, name: input.templateName, status: 'APPROVED' },
          });
          if (!template) throw BadRequest('That template was not found or is not yet approved');
          // Fill the template's variables: the first one is the contact's name.
          // Other values aren't guessed — a template needing more is refused.
          const variables = templateBodyVariables(template.bodyText);
          if (variables.length > 1) {
            throw BadRequest(`This template needs ${variables.length} values; only the contact name is supported right now`);
          }
          const bodyParams = variables.length === 1 ? [conversation.contactName?.trim() || 'there'] : [];
          const bodyParamNames = variables.map((v) => (v.named ? v.key : null));
          const sent = await sendWhatsAppTemplate(
            creds.phoneNumberId,
            creds.accessToken,
            conversation.externalContactId,
            template.name,
            template.language,
            bodyParams,
            bodyParamNames,
          );
          externalMessageId = sent.externalMessageId;
        } else if (input.mediaUrl && isPdfUrl(input.mediaUrl)) {
          const sent = await sendWhatsAppDocument(
            creds.phoneNumberId,
            creds.accessToken,
            conversation.externalContactId,
            input.mediaUrl,
            documentFilenameFromUrl(input.mediaUrl),
            input.body?.trim() || undefined,
          );
          externalMessageId = sent.externalMessageId;
        } else if (input.mediaUrl) {
          // WhatsApp supports a caption on the image itself — one message, not two.
          const sent = await sendWhatsAppImage(creds.phoneNumberId, creds.accessToken, conversation.externalContactId, input.mediaUrl, input.body?.trim() || undefined);
          externalMessageId = sent.externalMessageId;
        } else {
          const sent = await sendWhatsAppText(creds.phoneNumberId, creds.accessToken, conversation.externalContactId, input.body!);
          externalMessageId = sent.externalMessageId;
        }
      } else {
        const creds = decryptJson<InstagramCredentials>(connection.credentials);
        if (input.mediaUrl && isPdfUrl(input.mediaUrl)) {
          throw BadRequest('Instagram DMs only support photos, not documents');
        } else if (input.mediaUrl) {
          // Instagram's attachment message has no caption field — any typed
          // text alongside a photo is dropped rather than silently sent as a
          // separate, unlabeled second message.
          const sent = await sendInstagramImage(creds.igUserId, creds.accessToken, conversation.externalContactId, input.mediaUrl, igOptions).catch(explainInstagramWindow);
          externalMessageId = sent.externalMessageId;
        } else {
          const sent = await sendInstagramText(creds.igUserId, creds.accessToken, conversation.externalContactId, input.body!, igOptions).catch(explainInstagramWindow);
          externalMessageId = sent.externalMessageId;
        }
      }

      const message = await tx.message.create({
        data: {
          organizationId,
          conversationId,
          direction: 'OUTBOUND',
          externalMessageId,
          body: input.body || null,
          mediaUrl: input.mediaUrl,
          templateName: input.templateName,
          status: 'SENT',
          sentById: userId,
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date(), lastMessagePreview: preview.slice(0, 200) },
      });
      return message;
    } catch (err) {
      // Send failures are almost always AppError (Graph API 4xx/5xx) — the
      // global error handler skips console.error for those on purpose (they're
      // "expected" client-facing errors), which meant the real Graph API
      // failure reason was only ever visible in the stored message row, never
      // in server logs. Same gap already fixed in channels.service.ts.
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'Send failed';
      await tx.message.create({
        data: {
          organizationId,
          conversationId,
          direction: 'OUTBOUND',
          body: input.body || null,
          mediaUrl: input.mediaUrl,
          templateName: input.templateName,
          status: 'FAILED',
          errorMessage,
          sentById: userId,
        },
      });
      throw err;
    }
  });
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
