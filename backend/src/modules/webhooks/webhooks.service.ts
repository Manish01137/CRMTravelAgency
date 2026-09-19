import { systemPrisma, withTenant } from '../../lib/prisma';
import { findRepeatCustomerBooking } from '../../lib/leadBookingLinking';
import { decryptJson } from '../../lib/encryption';
import { uploadBufferToStorage } from '../../lib/storage';
import { fetchInstagramSenderProfile } from '../../lib/meta';
import { env } from '../../env';
import type { WhatsAppCredentials, InstagramCredentials } from '../channels/channels.service';

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

/** Instagram-via-Page routing — object:"page" webhooks identify themselves by Facebook Page id, stored separately from the IG-scoped account id. */
async function findConnectionOrgIdByPageId(pageId: string): Promise<string | null> {
  const connection = await systemPrisma.channelConnection.findFirst({
    where: { channel: 'INSTAGRAM', secondaryExternalId: pageId, status: 'CONNECTED' },
    select: { organizationId: true },
  });
  return connection?.organizationId ?? null;
}

type InboundLeadSource = 'WHATSAPP' | 'INSTAGRAM' | 'META_ADS' | 'INSTAGRAM_ADS';

/**
 * Instagram ad-originated conversations ("Send message" CTA ads, or DMs
 * opened from an ad) carry a `referral` object — either on the messaging
 * event itself (Messenger-style m.me referral) or nested in `message.referral`
 * — whose `source`/`type` names the ad. Anything else is an organic DM.
 */
function instagramLeadSource(
  event: Record<string, unknown>,
  message: { referral?: { source?: string; type?: string } } | undefined,
): InboundLeadSource {
  const referral = (event.referral as { source?: string; type?: string } | undefined) ?? message?.referral;
  const isAd = referral?.source === 'ADS' || referral?.type === 'OPEN_THREAD' || referral?.source === 'ad';
  return isAd ? 'INSTAGRAM_ADS' : 'INSTAGRAM';
}

/**
 * Downloads a WhatsApp media object (image/video/document) and re-hosts it at
 * a public Supabase Storage URL. Meta's own media URLs require the same
 * short-lived, per-app access token to fetch and expire after a few minutes —
 * unusable as a plain `<img src>` in the frontend — so this is a genuine
 * two-step fetch (metadata, then bytes) followed by our own upload, not just
 * a URL passthrough. Returns null (never throws) on any failure — an inbound
 * message with a broken media re-host still gets recorded, just without a
 * photo attached, rather than being dropped entirely.
 */
async function downloadWhatsAppMedia(organizationId: string, mediaId: string): Promise<string | null> {
  try {
    const connection = await systemPrisma.channelConnection.findUnique({
      where: { organizationId_channel: { organizationId, channel: 'WHATSAPP' } },
    });
    if (!connection?.credentials) return null;
    const { accessToken } = decryptJson<WhatsAppCredentials>(connection.credentials);

    const metaRes = await fetch(`https://graph.facebook.com/${env.META_GRAPH_VERSION}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) return null;
    const meta = (await metaRes.json()) as { url?: string; mime_type?: string };
    if (!meta.url) return null;

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!fileRes.ok) return null;
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const mimeType = meta.mime_type ?? 'image/jpeg';
    const ext = mimeType.split('/')[1]?.split(';')[0] ?? 'jpg';
    return await uploadBufferToStorage(buffer, mimeType, ext, `${organizationId}/whatsapp-media`);
  } catch (err) {
    console.error('downloadWhatsAppMedia failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** Same idea for an Instagram DM attachment — Meta's CDN attachment URL is
 *  fetchable directly (no access-token header needed) but is not guaranteed
 *  to stay valid long-term, so it's re-hosted the same way. */
async function downloadAndRehostImage(organizationId: string, sourceUrl: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = contentType.split('/')[1]?.split(';')[0] ?? 'jpg';
    return await uploadBufferToStorage(buffer, contentType, ext, `${organizationId}/instagram-media`);
  } catch (err) {
    console.error('downloadAndRehostImage failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Looks up a DM sender's display name AND profile picture via Instagram's
 * User Profile API — but only when we don't already have a name on file, to
 * respect Instagram's 200-calls/hour-per-account rate limit (re-fetching
 * unchanged info on every message from the same sender would burn through
 * it fast for no benefit). Never throws: a failed lookup (rate limit,
 * network issue, sender blocked the app, etc.) must never stop the actual
 * message from being recorded — falls back to both fields null, same as if
 * this lookup didn't exist. Shared by processInstagramEntry and
 * processPageEntry — both funnel real Instagram DMs into the same INSTAGRAM
 * channel/Conversation shape.
 *
 * The profile picture URL Meta returns expires after a few days (documented
 * on the User Profile API), so it's downloaded and re-hosted on our own
 * storage immediately via downloadAndRehostImage — same treatment as an
 * inbound DM image attachment. That function already never throws (it has
 * its own internal try/catch, returning null on any failure), so a broken
 * picture download can't lose the name computed alongside it here — no
 * separate try/catch needed around it.
 */
async function resolveInstagramContactInfo(
  organizationId: string,
  senderId: string,
): Promise<{ contactName: string | null; contactAvatarUrl: string | null }> {
  const none = { contactName: null, contactAvatarUrl: null };
  const existing = await withTenant(organizationId, (tx) =>
    tx.conversation.findUnique({
      where: { organizationId_channel_externalContactId: { organizationId, channel: 'INSTAGRAM', externalContactId: senderId } },
      select: { contactName: true },
    }),
  );
  // Already have a name — recordInbound's upsert leaves contactName/contactAvatarUrl alone when passed null, so no fetch needed.
  if (existing?.contactName) return none;

  try {
    const connection = await systemPrisma.channelConnection.findUnique({
      where: { organizationId_channel: { organizationId, channel: 'INSTAGRAM' } },
    });
    if (!connection?.credentials) return none;
    const { accessToken } = decryptJson<InstagramCredentials>(connection.credentials);
    const profile = await fetchInstagramSenderProfile(senderId, accessToken);
    const contactName = profile.name ?? (profile.username ? `@${profile.username}` : null);
    const contactAvatarUrl = profile.profilePicUrl ? await downloadAndRehostImage(organizationId, profile.profilePicUrl) : null;
    return { contactName, contactAvatarUrl };
  } catch (err) {
    console.error('resolveInstagramContactInfo failed:', err instanceof Error ? err.message : err);
    return none;
  }
}

/** Finds-or-creates the Lead + Conversation for an inbound message, then records it. */
async function recordInbound(params: {
  organizationId: string;
  channel: 'WHATSAPP' | 'INSTAGRAM';
  externalContactId: string;
  contactName: string | null;
  /** Instagram only — see resolveInstagramContactInfo. Always undefined/null for WhatsApp. */
  contactAvatarUrl?: string | null;
  contactPhone: string | null;
  body: string;
  mediaUrl?: string | null;
  interactiveSelectionId?: string | null;
  externalMessageId: string | null;
  leadSource: InboundLeadSource;
}): Promise<void> {
  const { organizationId, channel, externalContactId, contactName, contactAvatarUrl, contactPhone, body, mediaUrl, interactiveSelectionId, externalMessageId, leadSource } = params;

  await withTenant(organizationId, async (tx) => {
    const existing = await tx.conversation.findUnique({
      where: { organizationId_channel_externalContactId: { organizationId, channel, externalContactId } },
    });

    let leadId: string | undefined;
    if (!existing) {
      // Auto-create (or attach to) a Lead for a brand-new contact.
      let lead = contactPhone
        ? await tx.lead.findFirst({ where: { organizationId, phone: contactPhone } })
        : null;
      if (!lead) {
        const repeatBooking = await findRepeatCustomerBooking(tx, organizationId, contactPhone, null);
        lead = await tx.lead.create({
          data: {
            organizationId,
            name: contactName || (contactPhone ? contactPhone : `${channel === 'WHATSAPP' ? 'WhatsApp' : 'Instagram'} contact`),
            phone: contactPhone ?? undefined,
            source: leadSource,
            isRepeatCustomer: !!repeatBooking,
            repeatBookingId: repeatBooking?.id,
          },
        });
      }
      leadId = lead.id;
    }

    // upsert, not findUnique-then-create: two webhook deliveries for the same
    // brand-new contact can arrive as separate concurrent requests, each
    // seeing `existing` as null. A plain create() then races on the unique
    // constraint below — and catching that failure doesn't work either:
    // Postgres aborts the WHOLE transaction on a constraint violation, so any
    // further statement in it (even a harmless re-fetch) fails with 25P02
    // until rollback — confirmed by testing that approach here first, before
    // landing on upsert. Postgres resolves the conflict inside one atomic
    // INSERT ... ON CONFLICT statement instead, so there's never a separate
    // failed statement to recover from.
    const conversation = await tx.conversation.upsert({
      where: { organizationId_channel_externalContactId: { organizationId, channel, externalContactId } },
      create: { organizationId, channel, externalContactId, contactName, contactAvatarUrl, contactPhone, leadId },
      update: {
        ...(contactName ? { contactName } : {}),
        ...(contactAvatarUrl ? { contactAvatarUrl } : {}),
      },
    });

    await tx.message.create({
      data: {
        organizationId,
        conversationId: conversation.id,
        direction: 'INBOUND',
        externalMessageId,
        body: body || null,
        mediaUrl: mediaUrl ?? undefined,
        interactiveSelectionId: interactiveSelectionId ?? undefined,
        status: 'DELIVERED',
      },
    });
    const preview = mediaUrl ? (body.trim() ? body : '📷 Photo') : body;
    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastInboundAt: new Date(),
        lastMessagePreview: preview.slice(0, 200),
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
      // A tap on a Bot Flow CAROUSEL's list message arrives here as
      // type: 'interactive' with interactive.list_reply — its `id` is the
      // packageId we set when we sent the list (see bot-flow.engine.ts's
      // buildCarouselContent), so the Bot Flow engine can match it directly
      // instead of trying to parse free text. button_reply covered too, for
      // any future quick-reply-button use — same shape, different field name.
      let text: string;
      let mediaUrl: string | null = null;
      let interactiveSelectionId: string | null = null;
      if (type === 'text') {
        text = String((msg.text as { body?: string })?.body ?? '');
      } else if (type === 'interactive') {
        const interactive = (msg.interactive as { list_reply?: { id?: string; title?: string }; button_reply?: { id?: string; title?: string } }) ?? {};
        const reply = interactive.list_reply ?? interactive.button_reply;
        interactiveSelectionId = reply?.id ?? null;
        text = reply?.title ?? '[interactive message]';
      } else if (type === 'image') {
        const image = msg.image as { id?: string; caption?: string } | undefined;
        text = image?.caption ?? '';
        if (image?.id) mediaUrl = await downloadWhatsAppMedia(organizationId, image.id);
      } else {
        text = `[${type} message]`;
      }
      // "Click to WhatsApp" ad conversations carry a `referral` object on the
      // first message (source_type: "ad") — Meta's own signal that this
      // contact came from a paid ad rather than an organic WhatsApp message,
      // so the auto-created Lead can be tagged accordingly instead of always
      // landing as generic 'WHATSAPP'.
      const referral = msg.referral as { source_type?: string } | undefined;
      const leadSource: InboundLeadSource = referral?.source_type === 'ad' ? 'META_ADS' : 'WHATSAPP';
      await recordInbound({
        organizationId,
        channel: 'WHATSAPP',
        externalContactId: from,
        contactName: contact?.profile?.name ?? null,
        contactPhone: from,
        body: text,
        mediaUrl,
        interactiveSelectionId,
        externalMessageId: (msg.id as string) ?? null,
        leadSource,
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

type InstagramMessage = {
  mid?: string;
  text?: string;
  referral?: { source?: string; type?: string };
  attachments?: { type?: string; payload?: { url?: string } }[];
};

/** The first image attachment's Meta-hosted CDN URL, if this message carries one. */
function igImageAttachmentUrl(message: InstagramMessage | undefined): string | null {
  return message?.attachments?.find((a) => a.type === 'image')?.payload?.url ?? null;
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
    const message = event.message as InstagramMessage | undefined;
    const attachmentUrl = igImageAttachmentUrl(message);
    if (!message?.text && !attachmentUrl) continue;

    // Instagram DMs don't carry a display name/picture in the webhook
    // payload itself — looked up separately via the User Profile API
    // (Meta's "implicit consent" rule), at most once per sender.
    const { contactName, contactAvatarUrl } = await resolveInstagramContactInfo(organizationId, sender);
    await recordInbound({
      organizationId,
      channel: 'INSTAGRAM',
      externalContactId: sender,
      contactName,
      contactAvatarUrl,
      contactPhone: null,
      body: message?.text ?? '',
      mediaUrl: attachmentUrl ? await downloadAndRehostImage(organizationId, attachmentUrl) : null,
      externalMessageId: message?.mid ?? null,
      leadSource: instagramLeadSource(event, message),
    });
  }
}

/**
 * Real Instagram DMs, for an account connected via a linked Facebook Page
 * (this app's Instagram connect flow — see saveInstagramConnection), arrive
 * this way: object:"page", entry.id is the PAGE's id (not the IG-scoped
 * account id processInstagramEntry above matches on), same `messaging` array
 * shape otherwise. Was previously just logged and dropped — see the
 * "RAW PAGE WEBHOOK PAYLOAD" comment history for why.
 */
async function processPageEntry(entry: Record<string, unknown>): Promise<void> {
  const pageId = String(entry.id ?? '');
  console.log('[webhooks] processPageEntry — pageId:', pageId);
  if (!pageId) return;
  const organizationId = await findConnectionOrgIdByPageId(pageId);
  console.log('[webhooks] processPageEntry — findConnectionOrgIdByPageId result:', organizationId);
  if (!organizationId) {
    console.log('[webhooks] processPageEntry — no CONNECTED Instagram connection has secondaryExternalId =', pageId, '— dropping');
    return;
  }

  const messaging = Array.isArray(entry.messaging) ? (entry.messaging as Record<string, unknown>[]) : [];
  console.log('[webhooks] processPageEntry — messaging event count:', messaging.length, '| raw entry:', JSON.stringify(entry));
  for (const event of messaging) {
    const sender = String((event.sender as { id?: string })?.id ?? '');
    // Skip echoes of our own outbound sends (Meta can echo them back depending on subscription fields).
    if (!sender || sender === pageId) {
      console.log('[webhooks] processPageEntry — skipping event (no sender, or echo of our own page):', JSON.stringify(event));
      continue;
    }
    const message = event.message as InstagramMessage | undefined;
    const attachmentUrl = igImageAttachmentUrl(message);
    if (!message?.text && !attachmentUrl) {
      console.log('[webhooks] processPageEntry — skipping event with no text or image:', JSON.stringify(event));
      continue;
    }

    console.log('[webhooks] processPageEntry — recording inbound from sender:', sender, '| text:', message?.text);
    // See resolveInstagramContactInfo's comment in processInstagramEntry above.
    const { contactName, contactAvatarUrl } = await resolveInstagramContactInfo(organizationId, sender);
    await recordInbound({
      organizationId,
      channel: 'INSTAGRAM',
      externalContactId: sender,
      contactName,
      contactAvatarUrl,
      contactPhone: null,
      body: message?.text ?? '',
      mediaUrl: attachmentUrl ? await downloadAndRehostImage(organizationId, attachmentUrl) : null,
      externalMessageId: message?.mid ?? null,
      leadSource: instagramLeadSource(event, message),
    });
  }
}

/** Entry point for POST /webhooks/meta. Always resolves — callers must still respond 200 quickly to Meta. */
export async function processMetaWebhook(body: unknown): Promise<void> {
  const payload = body as { object?: string; entry?: Record<string, unknown>[] };
  // TEMP DEBUG: unconditional — every single webhook hit, whatever shape it
  // turns out to be, so we can see exactly what Meta actually sends for a
  // real Instagram DM instead of guessing at the payload shape again.
  console.log('[webhooks] RAW payload — object:', payload.object, '| full body:', JSON.stringify(body));

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  console.log('[webhooks] entry count:', entries.length);

  for (const entry of entries) {
    try {
      if (payload.object === 'whatsapp_business_account') {
        await processWhatsAppEntry(entry);
      } else if (payload.object === 'instagram') {
        console.log('[webhooks] routing entry to processInstagramEntry — entry.id:', entry.id);
        await processInstagramEntry(entry);
      } else if (payload.object === 'page') {
        console.log('[webhooks] routing entry to processPageEntry — entry.id:', entry.id);
        await processPageEntry(entry);
      } else {
        console.log('[webhooks] unrecognized object type, no handler:', payload.object);
      }
    } catch (err) {
      // One malformed/unexpected entry must never take down the rest of the batch
      // (or the webhook response) — log and continue.
      // eslint-disable-next-line no-console
      console.error('Meta webhook entry processing failed:', err instanceof Error ? err.message : err);
    }
  }
}
