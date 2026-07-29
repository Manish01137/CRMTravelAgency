import { systemPrisma, withTenant } from '../../lib/prisma';

/**
 * Meta sends WhatsApp + Instagram events to ONE shared webhook URL, so we
 * don't know which organization an event belongs to until we've read the
 * payload's `entry[].id` (the WABA id, or the Instagram-scoped account id)
 * and looked it up. That one lookup is the same "resolve org before an org
 * context exists" case `public.routes.ts` already uses `systemPrisma` for
 * (e.g. resolving a package by its public id). Every write that follows goes
 * through `withTenant`, so RLS still enforces isolation for the actual data —
 * a malicious/malformed payload can, at absolute worst, write into the ONE
 * organization whose real externalId happens to match; it can never cross
 * into another organization's rows.
 */

async function findConnectionOrgId(channel: 'WHATSAPP' | 'INSTAGRAM', externalId: string): Promise<string | null> {
  const connection = await systemPrisma.channelConnection.findFirst({
    where: { channel, externalId, status: 'CONNECTED' },
    select: { organizationId: true },
  });
  return connection?.organizationId ?? null;
}

/** Finds-or-creates the Lead + Conversation for an inbound message, then records it. */
async function recordInbound(params: {
  organizationId: string;
  channel: 'WHATSAPP' | 'INSTAGRAM';
  externalContactId: string;
  contactName: string | null;
  contactPhone: string | null;
  body: string;
  externalMessageId: string | null;
  leadSource: 'WHATSAPP' | 'INSTAGRAM';
}): Promise<void> {
  const { organizationId, channel, externalContactId, contactName, contactPhone, body, externalMessageId, leadSource } = params;

  await withTenant(organizationId, async (tx) => {
    let conversation = await tx.conversation.findUnique({
      where: { organizationId_channel_externalContactId: { organizationId, channel, externalContactId } },
    });

    if (!conversation) {
      // Auto-create (or attach to) a Lead for a brand-new contact.
      let lead = contactPhone
        ? await tx.lead.findFirst({ where: { organizationId, phone: contactPhone } })
        : null;
      if (!lead) {
        lead = await tx.lead.create({
          data: {
            organizationId,
            name: contactName || (contactPhone ? contactPhone : `${leadSource === 'WHATSAPP' ? 'WhatsApp' : 'Instagram'} contact`),
            phone: contactPhone ?? undefined,
            source: leadSource,
          },
        });
      }
      conversation = await tx.conversation.create({
        data: { organizationId, channel, externalContactId, contactName, contactPhone, leadId: lead.id },
      });
    } else if (contactName && conversation.contactName !== contactName) {
      conversation = await tx.conversation.update({ where: { id: conversation.id }, data: { contactName } });
    }

    await tx.message.create({
      data: {
        organizationId,
        conversationId: conversation.id,
        direction: 'INBOUND',
        externalMessageId,
        body,
        status: 'DELIVERED',
      },
    });
    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastInboundAt: new Date(),
        lastMessagePreview: body.slice(0, 200),
        unreadCount: { increment: 1 },
      },
    });
  });
}

/** Best-effort delivery/read status update for a message WE sent. Silently no-ops if unknown. */
async function updateOutboundStatus(organizationId: string, externalMessageId: string, status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED', errorMessage?: string) {
  await withTenant(organizationId, async (tx) => {
    await tx.message.updateMany({ where: { organizationId, externalMessageId }, data: { status, errorMessage } });
  });
}

/** Best-effort template-approval status sync. Silently no-ops if we don't recognize the template id. */
async function updateTemplateStatus(organizationId: string, externalTemplateId: string, status: 'APPROVED' | 'REJECTED' | 'PENDING') {
  await withTenant(organizationId, async (tx) => {
    await tx.messageTemplate.updateMany({ where: { organizationId, externalTemplateId }, data: { status } });
  });
}

async function processWhatsAppEntry(entry: Record<string, unknown>): Promise<void> {
  const wabaId = String(entry.id ?? '');
  if (!wabaId) return;
  const organizationId = await findConnectionOrgId('WHATSAPP', wabaId);
  if (!organizationId) return; // no organization has connected this WABA — nothing to do, nothing leaked

  const changes = Array.isArray(entry.changes) ? entry.changes : [];
  for (const change of changes) {
    const value = (change as { value?: Record<string, unknown> })?.value ?? {};
    const field = (change as { field?: string })?.field;

    if (field === 'message_template_status_update') {
      const templateId = String((value as { message_template_id?: string }).message_template_id ?? '');
      const event = String((value as { event?: string }).event ?? '');
      if (templateId && (event === 'APPROVED' || event === 'REJECTED' || event === 'PENDING')) {
        await updateTemplateStatus(organizationId, templateId, event as 'APPROVED' | 'REJECTED' | 'PENDING');
      }
      continue;
    }

    const contacts = Array.isArray(value.contacts) ? (value.contacts as { wa_id?: string; profile?: { name?: string } }[]) : [];
    const messages = Array.isArray(value.messages) ? (value.messages as Record<string, unknown>[]) : [];
    const statuses = Array.isArray(value.statuses) ? (value.statuses as Record<string, unknown>[]) : [];

    for (const msg of messages) {
      const from = String(msg.from ?? '');
      if (!from) continue;
      const contact = contacts.find((c) => c.wa_id === from);
      const type = String(msg.type ?? 'text');
      const text = type === 'text' ? String((msg.text as { body?: string })?.body ?? '') : `[${type} message]`;
      await recordInbound({
        organizationId,
        channel: 'WHATSAPP',
        externalContactId: from,
        contactName: contact?.profile?.name ?? null,
        contactPhone: from,
        body: text,
        externalMessageId: (msg.id as string) ?? null,
        leadSource: 'WHATSAPP',
      });
    }

    for (const st of statuses) {
      const messageId = String(st.id ?? '');
      const rawStatus = String(st.status ?? '');
      const mapped = rawStatus === 'sent' ? 'SENT' : rawStatus === 'delivered' ? 'DELIVERED' : rawStatus === 'read' ? 'READ' : rawStatus === 'failed' ? 'FAILED' : null;
      if (messageId && mapped) {
        const errors = Array.isArray(st.errors) ? (st.errors as { title?: string }[]) : [];
        await updateOutboundStatus(organizationId, messageId, mapped, errors[0]?.title);
      }
    }
  }
}

async function processInstagramEntry(entry: Record<string, unknown>): Promise<void> {
  const igAccountId = String(entry.id ?? '');
  if (!igAccountId) return;
  const organizationId = await findConnectionOrgId('INSTAGRAM', igAccountId);
  if (!organizationId) return;

  const messaging = Array.isArray(entry.messaging) ? (entry.messaging as Record<string, unknown>[]) : [];
  for (const event of messaging) {
    const sender = String((event.sender as { id?: string })?.id ?? '');
    // Skip echoes of our own outbound sends (Meta can echo them back depending on subscription fields).
    if (!sender || sender === igAccountId) continue;
    const message = event.message as { mid?: string; text?: string } | undefined;
    if (!message?.text) continue;

    await recordInbound({
      organizationId,
      channel: 'INSTAGRAM',
      externalContactId: sender,
      contactName: null, // Instagram DMs don't carry a display name in the webhook payload
      contactPhone: null,
      body: message.text,
      externalMessageId: message.mid ?? null,
      leadSource: 'INSTAGRAM',
    });
  }
}

/** Entry point for POST /webhooks/meta. Always resolves — callers must still respond 200 quickly to Meta. */
export async function processMetaWebhook(body: unknown): Promise<void> {
  const payload = body as { object?: string; entry?: Record<string, unknown>[] };
  const entries = Array.isArray(payload.entry) ? payload.entry : [];

  for (const entry of entries) {
    try {
      if (payload.object === 'whatsapp_business_account') {
        await processWhatsAppEntry(entry);
      } else if (payload.object === 'instagram') {
        await processInstagramEntry(entry);
      }
    } catch (err) {
      // One malformed/unexpected entry must never take down the rest of the batch
      // (or the webhook response) — log and continue.
      // eslint-disable-next-line no-console
      console.error('Meta webhook entry processing failed:', err instanceof Error ? err.message : err);
    }
  }
}
