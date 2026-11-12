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
  sendWhatsAppReaction,
  sendWhatsAppLocation,
  sendWhatsAppContact,
  sendWhatsAppVideo,
  sendWhatsAppAudioOrSticker,
  createWhatsAppTemplate,
  metaErrorText,
} from '../../lib/meta';
import { AppError, BadRequest, NotFound } from '../../lib/errors';
import { contactBody, locationBody, parseContactBody, parseLocationBody, richPreview } from '../../lib/richMessages';
import { isPlaceholderBody } from '../../lib/whatsappInbound';
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
// PDFs, and the Word / Excel / PowerPoint / text files customers send (forwarded on as documents).
const isPdfUrl = (url: string) => /\.(pdf|docx?|xlsx?|pptx?|txt|csv)(?:[?#]|$)/i.test(url);
const isVideoUrl = (url: string) => /\.(mp4|3gp|mov|webm)(?:[?#]|$)/i.test(url);
const isAudioUrl = (url: string) => /\.(ogg|opus|mp3|m4a|aac|amr)(?:[?#]|$)/i.test(url);
/** A sticker / voice note keeps its "[Sticker]"-style label as the body — it's never sent as text. */
const MEDIA_LABEL = /^\[(Sticker|Voice message|Audio file)\]$/;
const isStickerSend = (input: { mediaUrl?: string | null; body?: string | null }) => !!input.mediaUrl && input.body?.trim() === '[Sticker]';

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
      select: { ...CONVERSATION_SELECT, lead: { select: CONVERSATION_LEAD_SELECT } },
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

/** What the chat screen shows of a message — nothing more crosses the wire. */
const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  direction: true,
  externalMessageId: true, // no id at Meta → nothing to reply to
  body: true,
  mediaUrl: true,
  templateName: true,
  status: true,
  errorMessage: true,
  sentById: true,
  createdAt: true,
  replyTo: { select: { id: true, direction: true, body: true, mediaUrl: true, templateName: true } },
  starredAt: true,
  pinnedAt: true,
  customerReaction: true,
  agentReaction: true,
} as const;

/** What the chat list / header show of a conversation. */
const CONVERSATION_SELECT = {
  id: true,
  channel: true,
  externalContactId: true,
  contactName: true,
  contactAvatarUrl: true,
  contactPhone: true,
  leadId: true,
  lastMessageAt: true,
  lastMessagePreview: true,
  lastInboundAt: true,
  unreadCount: true,
  isFavorite: true,
} as const;

/** A chat opens on its newest messages; polls then ask only for what's new. */
const FULL_LOAD_LIMIT = 200;
/** Like WhatsApp: pinning a 4th message unpins the oldest. */
const MAX_PINNED = 3;
const NEWER_LIMIT = 100;
/** Sent messages whose ticks can still change (sent → delivered → read / failed). */
const STATUS_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * The open chat. Without `after`: the newest 200 messages (oldest first).
 * With `after` (the newest message the screen already has): only messages
 * from then on, plus the current status of recent sent messages so ticks
 * keep updating — the screen merges both into what it has.
 */
export async function listMessages(organizationId: string, conversationId: string, after?: Date) {
  return withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId }, select: CONVERSATION_SELECT });
    if (!conversation) throw NotFound('Conversation not found');
    let messages;
    let statuses:
      | {
          id: string;
          status: string;
          errorMessage: string | null;
          externalMessageId: string | null;
          customerReaction: string | null;
          agentReaction: string | null;
          deletedAt: Date | null;
        }[]
      | undefined;
    if (after) {
      // gte, not gt: two messages can share a millisecond — the screen drops ones it already has.
      messages = await tx.message.findMany({
        where: { conversationId, createdAt: { gte: after }, deletedAt: null },
        orderBy: { createdAt: 'asc' },
        take: NEWER_LIMIT,
        select: MESSAGE_SELECT,
      });
      // Recent messages whose ticks or reactions can still change (either side can react).
      statuses = await tx.message.findMany({
        where: { conversationId, createdAt: { gte: new Date(Date.now() - STATUS_WINDOW_MS) } },
        orderBy: { createdAt: 'desc' },
        take: 150,
        // deletedAt: a teammate hid it — the screen drops it.
        select: { id: true, status: true, errorMessage: true, externalMessageId: true, customerReaction: true, agentReaction: true, deletedAt: true },
      });
    } else {
      messages = (
        await tx.message.findMany({ where: { conversationId, deletedAt: null }, orderBy: { createdAt: 'desc' }, take: FULL_LOAD_LIMIT, select: MESSAGE_SELECT })
      ).reverse();
    }
    const lead = conversation.leadId ? await tx.lead.findUnique({ where: { id: conversation.leadId }, select: CONVERSATION_LEAD_SELECT }) : null;
    if (conversation.unreadCount > 0) {
      await tx.conversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } });
    }
    // Pinned at the top of the chat — may be older than the messages loaded.
    const pinned = await tx.message.findMany({
      where: { conversationId, pinnedAt: { not: null }, deletedAt: null },
      orderBy: { pinnedAt: 'desc' },
      take: MAX_PINNED,
      select: MESSAGE_SELECT,
    });
    return { conversation: { ...conversation, lead }, messages, pinned, ...(statuses && { statuses }) };
  });
}

/** What phase 1 hands to the Meta call — everything it needs, so the send itself touches no database. */
type SendPlan =
  | {
      channel: 'WHATSAPP';
      creds: WhatsAppCredentials;
      to: string;
      template: { name: string; language: string; params: string[]; paramNames: (string | null)[] } | null;
      /** Meta's id of the message being replied to. */
      replyToWamid?: string;
    }
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
    if (conversation.channel === 'INSTAGRAM' && (input.location || input.contact)) {
      throw BadRequest('Locations and contacts can be sent on WhatsApp chats');
    }
    if (conversation.channel === 'INSTAGRAM' && input.mediaUrl && isPdfUrl(input.mediaUrl)) {
      throw BadRequest('Instagram DMs only support photos, not documents');
    }
    if (conversation.channel === 'INSTAGRAM' && input.mediaUrl && (isVideoUrl(input.mediaUrl) || isAudioUrl(input.mediaUrl) || isStickerSend(input))) {
      throw BadRequest('From the CRM, Instagram DMs can only send photos — videos, voice notes and stickers work on WhatsApp');
    }
    if (conversation.channel === 'WHATSAPP' && input.mediaUrl && isVideoUrl(input.mediaUrl) && !/\.(mp4|3gp)(?:[?#]|$)/i.test(input.mediaUrl)) {
      throw BadRequest('WhatsApp only accepts MP4 videos (up to 16 MB)');
    }

    // Reply to a message: WhatsApp only, and not on a template (Meta's templates can't quote).
    let replyToId: string | undefined;
    let replyToWamid: string | undefined;
    if (input.replyToMessageId && conversation.channel === 'WHATSAPP' && !input.templateName) {
      const target = await tx.message.findFirst({ where: { id: input.replyToMessageId, conversationId }, select: { id: true, externalMessageId: true } });
      if (!target?.externalMessageId) throw BadRequest("That message can't be replied to — send this as a normal message instead");
      replyToId = target.id;
      replyToWamid = target.externalMessageId;
    }

    let plan: SendPlan;
    // A template sent without its text (e.g. to a group): the chat shows its text, filled in for this customer.
    let templateText: string | null = null;
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
        templateText = variables.length === 1 ? row.bodyText.replace(new RegExp(`\\{\\{\\s*${variables[0].key}\\s*\\}\\}`, 'g'), () => template!.params[0]) : row.bodyText;
      }
      plan = { channel: 'WHATSAPP', creds: decryptJson<WhatsAppCredentials>(connection.credentials), to: conversation.externalContactId, template, replyToWamid };
    } else {
      plan = {
        channel: 'INSTAGRAM',
        creds: decryptJson<InstagramCredentials>(connection.credentials),
        to: conversation.externalContactId,
        humanAgent: igSinceInbound > INSTAGRAM_WINDOW_MS,
      };
    }

    // A location / contact is stored as one bracketed line the Inbox shows as a card.
    const body = input.location
      ? locationBody(input.location)
      : input.contact
        ? contactBody([{ name: input.contact.name, phones: [input.contact.phone] }])
        : input.body || templateText || null;
    const preview = input.mediaUrl
      ? body && MEDIA_LABEL.test(body.trim())
        ? (richPreview(body) ?? body)
        : input.body?.trim()
          ? input.body
          : isVideoUrl(input.mediaUrl)
            ? '🎥 Video'
            : isAudioUrl(input.mediaUrl)
              ? '🎤 Voice message'
              : '📷 Photo'
      : body
        ? (richPreview(body) ?? body)
        : '';
    const message = await tx.message.create({
      data: {
        organizationId,
        conversationId,
        direction: 'OUTBOUND',
        body,
        mediaUrl: input.mediaUrl,
        templateName: input.templateName,
        status: 'QUEUED',
        sentById: userId,
        replyToId,
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
    const { creds, to, template, replyToWamid } = plan;
    if (template) {
      return sendWhatsAppTemplate(creds.phoneNumberId, creds.accessToken, to, template.name, template.language, template.params, template.paramNames);
    }
    if (input.location) return sendWhatsAppLocation(creds.phoneNumberId, creds.accessToken, to, input.location, replyToWamid);
    if (input.contact) return sendWhatsAppContact(creds.phoneNumberId, creds.accessToken, to, input.contact, replyToWamid);
    if (input.mediaUrl && isPdfUrl(input.mediaUrl)) {
      return sendWhatsAppDocument(creds.phoneNumberId, creds.accessToken, to, input.mediaUrl, documentFilenameFromUrl(input.mediaUrl), input.body?.trim() || undefined, replyToWamid);
    }
    if (input.mediaUrl && isAudioUrl(input.mediaUrl)) {
      return sendWhatsAppAudioOrSticker(creds.phoneNumberId, creds.accessToken, to, 'audio', input.mediaUrl, replyToWamid);
    }
    if (isStickerSend(input)) {
      return sendWhatsAppAudioOrSticker(creds.phoneNumberId, creds.accessToken, to, 'sticker', input.mediaUrl!, replyToWamid);
    }
    if (input.mediaUrl && isVideoUrl(input.mediaUrl)) {
      return sendWhatsAppVideo(creds.phoneNumberId, creds.accessToken, to, input.mediaUrl, input.body?.trim() || undefined, replyToWamid);
    }
    if (input.mediaUrl) {
      // WhatsApp supports a caption on the image itself — one message, not two.
      return sendWhatsAppImage(creds.phoneNumberId, creds.accessToken, to, input.mediaUrl, input.body?.trim() || undefined, replyToWamid);
    }
    return sendWhatsAppText(creds.phoneNumberId, creds.accessToken, to, input.body!, replyToWamid);
  }
  const { creds, to, humanAgent } = plan;
  // Instagram's attachment message has no caption field — any typed text
  // alongside a photo is dropped rather than silently sent as a separate,
  // unlabeled second message.
  if (input.mediaUrl) return sendInstagramImage(creds.igUserId, creds.accessToken, to, input.mediaUrl, { humanAgent }).catch(explainInstagramWindow);
  return sendInstagramText(creds.igUserId, creds.accessToken, to, input.body!, { humanAgent }).catch(explainInstagramWindow);
}

// --- One message: react, star, info ---------------------------------------------

/**
 * Our emoji reaction on a message (WhatsApp; "" removes it). Sent to Meta
 * first — outside any transaction — and saved only once Meta accepted it.
 */
export async function reactToMessage(organizationId: string, conversationId: string, messageId: string, emoji: string) {
  const { creds, to, wamid } = await withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId }, select: { channel: true, externalContactId: true } });
    if (!conversation) throw NotFound('Conversation not found');
    if (conversation.channel !== 'WHATSAPP') throw BadRequest('Reactions are available on WhatsApp chats');
    const message = await tx.message.findFirst({ where: { id: messageId, conversationId }, select: { externalMessageId: true } });
    if (!message) throw NotFound('Message not found');
    if (!message.externalMessageId) throw BadRequest("This message can't be reacted to");
    const connection = await tx.channelConnection.findUnique({ where: { organizationId_channel: { organizationId, channel: 'WHATSAPP' } } });
    if (!connection || connection.status !== 'CONNECTED' || !connection.credentials) throw BadRequest('WhatsApp is not connected');
    return { creds: decryptJson<WhatsAppCredentials>(connection.credentials), to: conversation.externalContactId, wamid: message.externalMessageId };
  });
  await sendWhatsAppReaction(creds.phoneNumberId, creds.accessToken, to, wamid, emoji);
  return withTenant(organizationId, (tx) =>
    tx.message.update({ where: { id: messageId }, data: { agentReaction: emoji || null }, select: { id: true, agentReaction: true } }),
  );
}

/** Star / unstar a message for the team (never shown to the customer). */
export async function starMessage(organizationId: string, conversationId: string, messageId: string, starred: boolean) {
  return withTenant(organizationId, async (tx) => {
    const message = await tx.message.findFirst({ where: { id: messageId, conversationId }, select: { id: true } });
    if (!message) throw NotFound('Message not found');
    return tx.message.update({ where: { id: messageId }, data: { starredAt: starred ? new Date() : null }, select: { id: true, starredAt: true } });
  });
}

/** This chat's starred messages, newest star first. */
export async function listStarredMessages(organizationId: string, conversationId: string) {
  return withTenant(organizationId, (tx) =>
    tx.message.findMany({ where: { conversationId, starredAt: { not: null }, deletedAt: null }, orderBy: { starredAt: 'desc' }, take: 100, select: MESSAGE_SELECT }),
  );
}

/** Pin / unpin a message at the top of the chat (team-only). A 4th pin replaces the oldest. */
export async function pinMessage(organizationId: string, conversationId: string, messageId: string, pinned: boolean) {
  return withTenant(organizationId, async (tx) => {
    const message = await tx.message.findFirst({ where: { id: messageId, conversationId, deletedAt: null }, select: { id: true } });
    if (!message) throw NotFound('Message not found');
    if (pinned) {
      const current = await tx.message.findMany({
        where: { conversationId, pinnedAt: { not: null }, deletedAt: null, id: { not: messageId } },
        orderBy: { pinnedAt: 'desc' },
        select: { id: true },
      });
      const unpin = current.slice(MAX_PINNED - 1).map((m) => m.id);
      if (unpin.length) await tx.message.updateMany({ where: { id: { in: unpin } }, data: { pinnedAt: null } });
    }
    await tx.message.update({ where: { id: messageId }, data: { pinnedAt: pinned ? new Date() : null } });
    return tx.message.findMany({
      where: { conversationId, pinnedAt: { not: null }, deletedAt: null },
      orderBy: { pinnedAt: 'desc' },
      take: MAX_PINNED,
      select: MESSAGE_SELECT,
    });
  });
}

/**
 * Several messages at once (Select): star, unstar, or delete. "Delete" hides
 * them from the Inbox — the customer still has them, and the rows are kept
 * (who and when) for the record.
 */
export async function bulkMessages(organizationId: string, conversationId: string, userId: string, action: 'star' | 'unstar' | 'delete', messageIds: string[]) {
  return withTenant(organizationId, async (tx) => {
    const ids = [...new Set(messageIds)];
    const where = { id: { in: ids }, conversationId, deletedAt: null };
    const found = await tx.message.count({ where });
    if (found !== ids.length) throw NotFound('Some of those messages are not in this chat');
    const data =
      action === 'star'
        ? { starredAt: new Date() }
        : action === 'unstar'
          ? { starredAt: null }
          : { deletedAt: new Date(), deletedById: userId, pinnedAt: null };
    const result = await tx.message.updateMany({ where, data });
    return { count: result.count };
  });
}

export interface ForwardResult {
  conversationId: string;
  sent: number;
  /** Why this chat stopped (e.g. outside WhatsApp's 24-hour window). */
  error?: string;
}

/**
 * Forwards messages to other chats on the same channel — sent as new messages
 * (WhatsApp shows no "Forwarded" label for business messages). Each chat goes
 * through the normal send rules (24-hour window etc.); a chat stops at its
 * first refusal and the rest carry on. Nothing is ever resent automatically.
 */
export async function forwardMessages(
  organizationId: string,
  userId: string,
  fromConversationId: string,
  messageIds: string[],
  toConversationIds: string[],
): Promise<ForwardResult[]> {
  const { source, channel, targets } = await withTenant(organizationId, async (tx) => {
    const from = await tx.conversation.findUnique({ where: { id: fromConversationId }, select: { channel: true } });
    if (!from) throw NotFound('Conversation not found');
    const source = await tx.message.findMany({
      where: { id: { in: messageIds }, conversationId: fromConversationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { body: true, mediaUrl: true },
    });
    const targets = await tx.conversation.findMany({ where: { id: { in: toConversationIds } }, select: { id: true, channel: true } });
    return { source, channel: from.channel, targets };
  });
  if (source.length === 0) throw BadRequest('Nothing to forward');
  if (targets.length !== new Set(toConversationIds).size) throw NotFound('Chat not found');
  if (targets.some((t) => t.channel !== channel)) throw BadRequest('Forward to chats on the same channel');

  const sendable = source.map((m) => forwardInput(m, channel)).filter((x): x is SendMessageInput => x !== null);
  if (sendable.length === 0) throw BadRequest("These messages can't be forwarded (calls, voice notes and stickers aren't sendable)");

  const results: ForwardResult[] = [];
  for (const target of toConversationIds) {
    let sent = 0;
    try {
      for (const input of sendable) {
        await sendMessage(organizationId, target, userId, input);
        sent++;
      }
      results.push({ conversationId: target, sent });
    } catch (err) {
      results.push({ conversationId: target, sent, error: err instanceof Error ? err.message : 'Could not send' });
    }
  }
  return results;
}

/** One stored message as something we can send again (null when it isn't sendable). */
function forwardInput(m: { body: string | null; mediaUrl: string | null }, channel: string): SendMessageInput | null {
  const location = parseLocationBody(m.body);
  if (location) {
    return channel === 'WHATSAPP'
      ? ({ location: { latitude: location.latitude, longitude: location.longitude, ...(location.name && { name: location.name }) } } as SendMessageInput)
      : ({ body: `📍 ${location.name ?? 'Location'}\nhttps://maps.google.com/?q=${location.latitude},${location.longitude}` } as SendMessageInput);
  }
  const people = parseContactBody(m.body);
  if (people?.[0]?.phones[0]) {
    const p = people[0];
    return channel === 'WHATSAPP'
      ? ({ contact: { name: p.name, phone: p.phones[0] } } as SendMessageInput)
      : ({ body: `${p.name}: ${p.phones.join(', ')}` } as SendMessageInput);
  }
  // A file's "[Document: x.pdf]" label, "[Voice message]"… aren't text to send on.
  // …except a sticker's / voice note's label, which says what the file is (it isn't sent as text).
  const label = m.mediaUrl && m.body && MEDIA_LABEL.test(m.body.trim()) ? m.body.trim() : undefined;
  const body = label ?? (m.body && !isPlaceholderBody(m.body) ? m.body : undefined);
  if (!body && !m.mediaUrl) return null;
  return { body, mediaUrl: m.mediaUrl ?? undefined } as SendMessageInput;
}

/**
 * A Google Maps link (incl. short maps.app.goo.gl links) or "lat, lng" → a map
 * pin to send. Only Google Maps addresses are ever fetched.
 */
export async function resolveLocationLink(link: string): Promise<{ latitude: number; longitude: number; name: string | null }> {
  const typed = link.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (typed) return checkCoords(Number(typed[1]), Number(typed[2]), null);
  let url = link.trim();
  for (let hop = 0; hop < 4; hop++) {
    const found = coordsFromMapsUrl(url);
    if (found) return checkCoords(found.lat, found.lng, found.name);
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      break;
    }
    const host = parsed.hostname.replace(/^www\./, '');
    const google = host === 'maps.app.goo.gl' || host === 'goo.gl' || host === 'maps.google.com' || /^google\.[a-z.]+$/.test(host);
    if (!google || parsed.protocol !== 'https:') break;
    // Short links redirect to the full one — follow it ourselves, Google only.
    const res = await fetch(url, { redirect: 'manual' }).catch(() => null);
    const next = res?.headers.get('location');
    if (!next) break;
    url = new URL(next, url).toString();
  }
  throw BadRequest('Could not read a location from that link — paste a Google Maps link, or type it as "latitude, longitude"');
}

function coordsFromMapsUrl(url: string): { lat: number; lng: number; name: string | null } | null {
  const decoded = (() => {
    try {
      return decodeURIComponent(url);
    } catch {
      return url;
    }
  })();
  const name = decoded.match(/\/place\/([^/@]+)/)?.[1]?.replace(/\+/g, ' ').trim() || null;
  const patterns = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),(-?\d+\.\d+)/, /[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/];
  for (const p of patterns) {
    const m = decoded.match(p);
    if (m) return { lat: Number(m[1]), lng: Number(m[2]), name };
  }
  return null;
}

function checkCoords(latitude: number, longitude: number, name: string | null) {
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw BadRequest('Those coordinates are not a real place');
  return { latitude, longitude, name };
}

/** Message info: when it was sent, delivered and read (or why it failed), and who sent it. */
export async function getMessageInfo(organizationId: string, conversationId: string, messageId: string) {
  return withTenant(organizationId, async (tx) => {
    const message = await tx.message.findFirst({
      where: { id: messageId, conversationId },
      select: {
        id: true,
        direction: true,
        status: true,
        createdAt: true,
        deliveredAt: true,
        readAt: true,
        errorMessage: true,
        templateName: true,
        starredAt: true,
        sentBy: { select: { name: true } },
      },
    });
    if (!message) throw NotFound('Message not found');
    return message;
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

// --- Contact info: what's been shared in this chat ----------------------------------

const SHARED_DOC = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|ogg|opus|mp3|m4a|aac|amr)(?:[?#]|$)/i;
const LINK = /https?:\/\/[^\s<>"')\]]+/g;

/**
 * Contact info panel: photos & videos, documents (and voice notes), and links
 * shared either way in this chat — newest first — plus a little history.
 */
export async function listSharedItems(organizationId: string, conversationId: string) {
  return withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId }, select: { id: true, createdAt: true } });
    if (!conversation) throw NotFound('Conversation not found');
    const visible = { conversationId, deletedAt: null };
    const [files, withLinks, counts, first] = await Promise.all([
      tx.message.findMany({
        where: { ...visible, mediaUrl: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 300,
        select: { id: true, direction: true, mediaUrl: true, body: true, createdAt: true },
      }),
      tx.message.findMany({
        where: { ...visible, body: { contains: 'http' } },
        orderBy: { createdAt: 'desc' },
        take: 150,
        select: { id: true, direction: true, body: true, createdAt: true },
      }),
      tx.message.groupBy({ by: ['direction'], where: visible, _count: { _all: true } }),
      tx.message.findFirst({ where: visible, orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    ]);
    const media = files.filter((m) => !SHARED_DOC.test(m.mediaUrl!));
    const docs = files.filter((m) => SHARED_DOC.test(m.mediaUrl!));
    const links = withLinks.flatMap((m) =>
      [...new Set(m.body!.match(LINK) ?? [])].map((url) => ({ messageId: m.id, direction: m.direction, url: url.replace(/[.,!?]+$/, ''), createdAt: m.createdAt })),
    );
    const count = (d: 'INBOUND' | 'OUTBOUND') => counts.find((c) => c.direction === d)?._count._all ?? 0;
    return {
      media: media.slice(0, 120),
      docs: docs.slice(0, 120),
      links: links.slice(0, 120),
      stats: { received: count('INBOUND'), sent: count('OUTBOUND'), firstMessageAt: first?.createdAt ?? conversation.createdAt },
    };
  });
}

// --- Stickers ---------------------------------------------------------------------

/** Stickers this business has received or sent (newest first) — the sticker picker's list. */
export async function listRecentStickers(organizationId: string) {
  return withTenant(organizationId, async (tx) => {
    const rows = await tx.message.findMany({
      where: { body: '[Sticker]', mediaUrl: { not: null }, deletedAt: null, conversation: { channel: 'WHATSAPP' } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { mediaUrl: true },
    });
    return [...new Set(rows.map((r) => r.mediaUrl!))].slice(0, 48);
  });
}
