import { withTenant } from '../../lib/prisma';
import { decryptJson } from '../../lib/encryption';
import { sendWhatsAppText, sendWhatsAppTemplate, sendInstagramText, createWhatsAppTemplate } from '../../lib/meta';
import { BadRequest, NotFound } from '../../lib/errors';
import type { WhatsAppCredentials, InstagramCredentials } from '../channels/channels.service';
import type { CreateTemplateInput, ListConversationsQuery, SendMessageInput } from './inbox.schemas';

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function listConversations(organizationId: string, query: ListConversationsQuery) {
  return withTenant(organizationId, (tx) =>
    tx.conversation.findMany({
      where: {
        organizationId,
        channel: query.channel,
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
    }),
  );
}

export async function listMessages(organizationId: string, conversationId: string) {
  return withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw NotFound('Conversation not found');
    const messages = await tx.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' }, take: 500 });
    if (conversation.unreadCount > 0) {
      await tx.conversation.update({ where: { id: conversationId }, data: { unreadCount: 0 } });
    }
    return { conversation, messages };
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

    try {
      let externalMessageId: string;
      if (conversation.channel === 'WHATSAPP') {
        const creds = decryptJson<WhatsAppCredentials>(connection.credentials);
        if (input.templateName) {
          const template = await tx.messageTemplate.findFirst({
            where: { organizationId, name: input.templateName, status: 'APPROVED' },
          });
          if (!template) throw BadRequest('That template was not found or is not yet approved');
          const sent = await sendWhatsAppTemplate(creds.phoneNumberId, creds.accessToken, conversation.externalContactId, template.name, template.language);
          externalMessageId = sent.externalMessageId;
        } else {
          const sent = await sendWhatsAppText(creds.phoneNumberId, creds.accessToken, conversation.externalContactId, input.body);
          externalMessageId = sent.externalMessageId;
        }
      } else {
        const creds = decryptJson<InstagramCredentials>(connection.credentials);
        const sent = await sendInstagramText(creds.igUserId, creds.accessToken, conversation.externalContactId, input.body);
        externalMessageId = sent.externalMessageId;
      }

      const message = await tx.message.create({
        data: {
          organizationId,
          conversationId,
          direction: 'OUTBOUND',
          externalMessageId,
          body: input.body,
          templateName: input.templateName,
          status: 'SENT',
          sentById: userId,
        },
      });
      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date(), lastMessagePreview: input.body.slice(0, 200) },
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
          body: input.body,
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
    const { externalTemplateId } = await createWhatsAppTemplate(connection.externalId, creds.accessToken, input);
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
