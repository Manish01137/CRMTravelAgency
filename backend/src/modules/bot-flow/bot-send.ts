import { withTenant } from '../../lib/prisma';
import { decryptJson } from '../../lib/encryption';
import { env } from '../../env';
import {
  sendWhatsAppText,
  sendInstagramText,
  sendWhatsAppImage,
  sendWhatsAppCarousel,
  sendWhatsAppButtons,
  sendWhatsAppList,
  sendWhatsAppVideo,
  sendWhatsAppDocument,
  sendInstagramImage,
  sendInstagramVideo,
  sendInstagramQuickReplies,
  sendInstagramCards,
  type InstagramCard,
  type WhatsAppCarouselCard,
  type WhatsAppChoice,
} from '../../lib/meta';
import type { WhatsAppCredentials, InstagramCredentials } from '../channels/channels.service';

/**
 * Sending for the bots (Bot Flow, ad auto-send, Smart Bot) — plain messages,
 * and the two package formats travellers see:
 *   - one package: its photo with a caption (name, duration, price,
 *     description, link), or the same text when there's no photo;
 *   - several packages: a WhatsApp carousel of cards, each with the package
 *     photo and a "View package" button opening its page.
 * Every send is recorded in the Inbox thread.
 */

export type BotChannel = 'WHATSAPP' | 'INSTAGRAM';

export interface SendResult {
  ok: boolean;
  externalMessageId?: string;
  errorMessage?: string;
}

async function credentialsFor(organizationId: string, channel: BotChannel) {
  // A short read-only lookup, its own fast transaction — never held open across the send.
  const connection = await withTenant(organizationId, (tx) =>
    tx.channelConnection.findUnique({ where: { organizationId_channel: { organizationId, channel } } }),
  );
  return connection?.credentials ?? null;
}

async function trySend(fn: () => Promise<{ externalMessageId: string }>): Promise<SendResult> {
  try {
    const sent = await fn();
    return { ok: true, externalMessageId: sent.externalMessageId };
  } catch (err) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : 'Send failed' };
  }
}

/**
 * Instagram shows WhatsApp's *bold* / _italic_ / ~strike~ markers literally —
 * drop them so the same flow text reads cleanly on both channels.
 */
export function plainForInstagram(text: string): string {
  return text
    .replace(/```([^`]+)```/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?:;])/gm, '$1$2')
    .replace(/(^|[\s(])~([^~\n]+)~(?=$|[\s).,!?:;])/gm, '$1$2');
}

export async function attemptSend(organizationId: string, channel: BotChannel, externalContactId: string, body: string): Promise<SendResult | null> {
  const credentials = await credentialsFor(organizationId, channel);
  if (!credentials) return null; // channel got disconnected — nothing safe to do
  if (channel === 'WHATSAPP') {
    const creds = decryptJson<WhatsAppCredentials>(credentials);
    return trySend(() => sendWhatsAppText(creds.phoneNumberId, creds.accessToken, externalContactId, body));
  }
  const creds = decryptJson<InstagramCredentials>(credentials);
  return trySend(() => sendInstagramText(creds.igUserId, creds.accessToken, externalContactId, plainForInstagram(body)));
}

async function instagramCreds(organizationId: string): Promise<InstagramCredentials | null> {
  const credentials = await credentialsFor(organizationId, 'INSTAGRAM');
  return credentials ? decryptJson<InstagramCredentials>(credentials) : null;
}

export async function recordOutbound(
  organizationId: string,
  conversationId: string,
  body: string,
  result: SendResult | null,
  mediaUrl?: string,
): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const conv = await tx.conversation.findUnique({ where: { id: conversationId }, select: { channel: true } });
    if (conv?.channel === 'INSTAGRAM') body = plainForInstagram(body);
    await tx.message.create({
      data: {
        organizationId,
        conversationId,
        direction: 'OUTBOUND',
        body,
        mediaUrl,
        status: result?.ok ? 'SENT' : 'FAILED',
        externalMessageId: result?.externalMessageId,
        errorMessage: result?.errorMessage,
        sentById: null,
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), lastMessagePreview: (mediaUrl ? `📷 ${body}` : body).slice(0, 200) },
    });
  });
}

// --- Media (photo / video / PDF) -------------------------------------------------

export interface StepMedia {
  type: 'image' | 'video' | 'document';
  url: string;
  /** PDFs: the file name the traveller sees. */
  filename?: string;
}

const MEDIA_LABEL: Record<StepMedia['type'], string> = { image: 'Photo', video: 'Video', document: 'PDF' };

function pdfName(media: StepMedia): string {
  const name = (media.filename || media.url.split('/').pop()?.split(/[?#]/)[0] || 'document.pdf').replace(/^\d+-[0-9a-f]+-/, '');
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}

/** WhatsApp: the media with `caption` under it (one message). */
async function sendWhatsAppMedia(organizationId: string, to: string, media: StepMedia, caption: string): Promise<SendResult | null> {
  const credentials = await credentialsFor(organizationId, 'WHATSAPP');
  if (!credentials) return null;
  const creds = decryptJson<WhatsAppCredentials>(credentials);
  const cap = caption ? caption.slice(0, 1024) : undefined;
  return trySend(() =>
    media.type === 'image'
      ? sendWhatsAppImage(creds.phoneNumberId, creds.accessToken, to, media.url, cap)
      : media.type === 'video'
        ? sendWhatsAppVideo(creds.phoneNumberId, creds.accessToken, to, media.url, cap)
        : sendWhatsAppDocument(creds.phoneNumberId, creds.accessToken, to, media.url, pdfName(media), cap),
  );
}

/**
 * Sends a message with a photo, video or PDF. WhatsApp: one media message
 * with the text as its caption. Instagram: the photo, then the text (videos
 * and PDFs go as a link). Falls back to text + link if the media is refused.
 */
export async function sendMediaMessage(
  organizationId: string,
  channel: BotChannel,
  to: string,
  conversationId: string,
  media: StepMedia,
  text: string,
): Promise<SendResult | null> {
  if (channel === 'WHATSAPP') {
    const result = await sendWhatsAppMedia(organizationId, to, media, text);
    if (result?.ok) {
      await recordOutbound(organizationId, conversationId, text, result, media.url);
      return result;
    }
    if (result) console.warn('[bot-send] media send failed, sending text + link:', result.errorMessage);
  } else if (media.type !== 'document') {
    const creds = await instagramCreds(organizationId);
    if (!creds) return null;
    const photo = await trySend(() =>
      media.type === 'image'
        ? sendInstagramImage(creds.igUserId, creds.accessToken, to, media.url)
        : sendInstagramVideo(creds.igUserId, creds.accessToken, to, media.url),
    );
    if (photo.ok) {
      await recordOutbound(organizationId, conversationId, '', photo, media.url);
      if (!text) return photo;
      const result = await attemptSend(organizationId, channel, to, text);
      await recordOutbound(organizationId, conversationId, text, result);
      return result;
    }
  }
  const withLink = [text, `${MEDIA_LABEL[media.type]}: ${media.url}`].filter(Boolean).join('\n\n');
  const result = await attemptSend(organizationId, channel, to, withLink);
  await recordOutbound(organizationId, conversationId, withLink, result);
  return result;
}

// --- Questions with tappable options -------------------------------------------

export interface Choice {
  /** Returned as the tap's interactiveSelectionId. */
  id: string;
  label: string;
  description?: string;
}

/** "Question\n\n1. Yes\n2. No" — how a choice question reads as plain text (Instagram, fallbacks, the Inbox). */
export function numberedChoices(question: string, choices: Choice[]): string {
  return [question, choices.map((c, i) => `${i + 1}. ${c.label}`).join('\n')].join('\n\n');
}

/**
 * Sends a question with options to tap. WhatsApp: up to 3 short options
 * (≤ 20 chars) become reply buttons; otherwise a list menu (up to 10 rows,
 * long labels carried into the row description). Instagram, or if WhatsApp
 * rejects it: a numbered text list — the engine accepts "1", "2", … too.
 */
export async function sendChoices(
  organizationId: string,
  channel: BotChannel,
  to: string,
  conversationId: string,
  question: string,
  choices: Choice[],
  listButtonLabel = 'Choose an option',
  media?: StepMedia,
): Promise<SendResult | null> {
  const asText = numberedChoices(question, choices);
  if (channel === 'WHATSAPP' && choices.length > 0 && choices.length <= 10) {
    const credentials = await credentialsFor(organizationId, channel);
    if (!credentials) return null;
    const creds = decryptJson<WhatsAppCredentials>(credentials);
    const useButtons = choices.length <= 3 && choices.every((c) => c.label.length <= 20);
    // A list can't carry media — the photo/video/PDF goes just before it.
    let mediaSent = false;
    if (media && !useButtons) {
      const sent = await sendWhatsAppMedia(organizationId, to, media, '');
      if (sent?.ok) {
        await recordOutbound(organizationId, conversationId, '', sent, media.url);
        mediaSent = true;
      }
    }
    const result = await trySend(() => {
      if (useButtons) {
        const header = media
          ? media.type === 'document'
            ? ({ type: 'document', link: media.url, filename: pdfName(media) } as const)
            : ({ type: media.type, link: media.url } as const)
          : undefined;
        return sendWhatsAppButtons(creds.phoneNumberId, creds.accessToken, to, question, choices.map((c) => ({ id: c.id, title: c.label })), header);
      }
      const rows: WhatsAppChoice[] = choices.map((c) => ({
        id: c.id,
        title: c.label.length <= 24 ? c.label : clip(c.label, 24),
        description: c.description || (c.label.length > 24 ? clip(c.label, 72) : undefined),
      }));
      return sendWhatsAppList(creds.phoneNumberId, creds.accessToken, to, question, listButtonLabel, rows);
    });
    if (result.ok) {
      await recordOutbound(organizationId, conversationId, asText, result, useButtons ? media?.url : undefined);
      return result;
    }
    console.warn('[bot-send] interactive question failed, sending numbered text:', result.errorMessage);
    if (media && !mediaSent) return sendMediaMessage(organizationId, channel, to, conversationId, media, asText);
  } else if (channel === 'INSTAGRAM' && choices.length > 0 && choices.length <= 13) {
    // Instagram: the question with tappable quick-reply chips (media first, if any).
    const creds = await instagramCreds(organizationId);
    if (!creds) return null;
    if (media) await sendMediaMessage(organizationId, channel, to, conversationId, media, '');
    const result = await trySend(() =>
      sendInstagramQuickReplies(
        creds.igUserId,
        creds.accessToken,
        to,
        plainForInstagram(question),
        choices.map((c) => ({ title: c.label.length <= 20 ? c.label : clip(c.label, 20), payload: c.id })),
      ),
    );
    if (result.ok) {
      await recordOutbound(organizationId, conversationId, asText, result);
      return result;
    }
    console.warn('[bot-send] Instagram quick replies failed, sending numbered text:', result.errorMessage);
  } else if (media) {
    return sendMediaMessage(organizationId, channel, to, conversationId, media, asText);
  }
  const result = await attemptSend(organizationId, channel, to, asText);
  await recordOutbound(organizationId, conversationId, asText, result);
  return result;
}

// --- Package content ----------------------------------------------------------

type PackageRow = NonNullable<Awaited<ReturnType<typeof loadPackages>>[number]>;

async function loadPackages(organizationId: string, packageIds: string[]) {
  if (packageIds.length === 0) return [];
  const found = await withTenant(organizationId, (tx) => tx.package.findMany({ where: { id: { in: packageIds }, organizationId } }));
  // Keep the order the caller gave, not the database's.
  return packageIds.map((id) => found.find((p) => p.id === id)).filter((p): p is (typeof found)[number] => !!p);
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export const packageUrl = (packageId: string) => `${env.CORS_ORIGIN}/p/${packageId}`;

/** "Manali Kasol — Manali", or just the name when the destination adds nothing ("Jaisalmer — Jaisalmer"). */
function packageTitle(pkg: PackageRow): string {
  const name = pkg.name.trim();
  const dest = pkg.destination?.trim();
  return dest && !name.toLowerCase().includes(dest.toLowerCase()) ? `${name} — ${dest}` : name;
}

function durationAndPrice(pkg: PackageRow): string {
  const price = pkg.priceAmount != null ? formatMoney(pkg.priceAmount, pkg.priceCurrency) : null;
  return `${pkg.days}D / ${pkg.nights}N${price ? ` · ${price}` : ''}`;
}

/** Cut at a word boundary with an ellipsis. */
function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The WhatsApp blurb if the agency wrote one, otherwise the package description. */
function packageBlurb(pkg: PackageRow): string {
  return (pkg.whatsappDescription || pkg.description || '').trim();
}

/** The picture that represents a package: WhatsApp banner, banner, gallery, then any day/sightseeing photo. */
function packageImage(pkg: PackageRow): string | null {
  const itinerary = (Array.isArray(pkg.itinerary) ? pkg.itinerary : []) as {
    images?: string[];
    activityBlocks?: { imageUrl?: string }[];
  }[];
  const candidates = [
    pkg.whatsappBannerUrl,
    pkg.bannerImageUrl,
    ...(Array.isArray(pkg.galleryImages) ? (pkg.galleryImages as string[]) : []),
    ...itinerary.flatMap((d) => [...(d.images ?? []), ...(d.activityBlocks ?? []).map((b) => b.imageUrl)]),
  ];
  return candidates.find((u): u is string => !!u && /^https?:\/\//.test(u)) ?? null;
}

/** Full package message: title, duration & price, description, link. Fits a WhatsApp image caption (1024). */
function packageCaption(pkg: PackageRow): string {
  const head = `*${packageTitle(pkg)}*\n${durationAndPrice(pkg)}`;
  const link = `View full itinerary: ${packageUrl(pkg.id)}`;
  const blurb = packageBlurb(pkg);
  const room = 1024 - head.length - link.length - 4;
  return [head, blurb ? clip(blurb, Math.min(500, room)) : null, link].filter(Boolean).join('\n\n');
}

/** Text version of a package (Smart Bot replies and anywhere a plain message is needed). */
export async function buildPackageContent(organizationId: string, packageId: string | undefined): Promise<string | null> {
  if (!packageId) return null;
  const [pkg] = await loadPackages(organizationId, [packageId]);
  return pkg ? packageCaption(pkg) : null;
}

/**
 * Sends one package. WhatsApp: the package photo with the details as its
 * caption (falls back to text if there's no photo or WhatsApp can't fetch it).
 * Instagram: a card with the photo and a "View package" button, then the description.
 */
export async function sendPackage(
  organizationId: string,
  channel: BotChannel,
  to: string,
  conversationId: string,
  packageId: string,
): Promise<SendResult | null> {
  const [pkg] = await loadPackages(organizationId, [packageId]);
  if (!pkg) return null;
  const caption = packageCaption(pkg);
  const image = packageImage(pkg);

  if (channel === 'WHATSAPP' && image) {
    const credentials = await credentialsFor(organizationId, channel);
    if (!credentials) return null;
    const creds = decryptJson<WhatsAppCredentials>(credentials);
    const result = await trySend(() => sendWhatsAppImage(creds.phoneNumberId, creds.accessToken, to, image, caption));
    if (result.ok) {
      await recordOutbound(organizationId, conversationId, caption, result, image);
      return result;
    }
    console.warn('[bot-send] package photo send failed, sending as text:', result.errorMessage);
  }
  if (channel === 'INSTAGRAM') {
    // A card (photo, name, duration & price, "View package"), then the description.
    const sent = await sendInstagramPackageCards(organizationId, to, conversationId, [pkg]);
    if (sent?.ok) {
      const blurb = packageBlurb(pkg);
      if (blurb) {
        const text = clip(blurb, 900);
        const r = await attemptSend(organizationId, channel, to, text);
        await recordOutbound(organizationId, conversationId, text, r);
      }
      return sent;
    }
  }
  const result = await attemptSend(organizationId, channel, to, caption);
  await recordOutbound(organizationId, conversationId, caption, result);
  return result;
}

/** Card text: bold name, duration & price, then as much description as fits WhatsApp's 160 chars / 2 line breaks. */
function cardText(pkg: PackageRow): string {
  const name = clip(pkg.name, 60);
  const head = `*${name}*\n${durationAndPrice(pkg)}`;
  const blurb = packageBlurb(pkg);
  const room = 160 - head.length - 1;
  return blurb && room > 20 ? `${head}\n${clip(blurb, room)}` : head.slice(0, 160);
}

/**
 * Sends several packages. WhatsApp: a swipeable carousel — one card per
 * package with its photo and a "View package" button opening its page
 * (a package with no photo uses the agency logo). One package is sent as a
 * single package message. Falls back to a text list with a link per package
 * on Instagram, when photos are missing, or if WhatsApp rejects the carousel.
 */
export async function sendPackageCarousel(
  organizationId: string,
  channel: BotChannel,
  to: string,
  conversationId: string,
  packageIds: string[],
  intro = 'Take a look at these packages 👇',
): Promise<SendResult | null> {
  const packages = (await loadPackages(organizationId, packageIds)).slice(0, 10);
  if (packages.length === 0) return null;
  if (packages.length === 1) return sendPackage(organizationId, channel, to, conversationId, packages[0].id);

  const summary = [intro, ...packages.map((p) => `• ${packageTitle(p)} — ${packageUrl(p.id)}`)].join('\n');

  if (channel === 'WHATSAPP') {
    const org = await withTenant(organizationId, (tx) => tx.organization.findUnique({ where: { id: organizationId }, select: { logoUrl: true } }));
    const fallbackImage = org?.logoUrl && /^https?:\/\//.test(org.logoUrl) ? org.logoUrl : null;
    const cards: WhatsAppCarouselCard[] = [];
    for (const p of packages) {
      const imageUrl = packageImage(p) ?? fallbackImage;
      if (!imageUrl) break; // WhatsApp requires a photo on every card
      cards.push({ imageUrl, text: cardText(p), buttonText: 'View package', url: packageUrl(p.id) });
    }
    if (cards.length === packages.length) {
      const credentials = await credentialsFor(organizationId, channel);
      if (!credentials) return null;
      const creds = decryptJson<WhatsAppCredentials>(credentials);
      const result = await trySend(() => sendWhatsAppCarousel(creds.phoneNumberId, creds.accessToken, to, intro, cards));
      if (result.ok) {
        await recordOutbound(organizationId, conversationId, summary, result);
        return result;
      }
      console.warn('[bot-send] carousel send failed, sending a text list:', result.errorMessage);
    }
  }

  if (channel === 'INSTAGRAM') {
    const introResult = await attemptSend(organizationId, channel, to, intro);
    await recordOutbound(organizationId, conversationId, intro, introResult);
    const sent = await sendInstagramPackageCards(organizationId, to, conversationId, packages);
    if (sent?.ok) return sent;
  }

  const text = [
    ...(channel === 'INSTAGRAM' ? [] : [intro]),
    ...packages.map((p) => `*${packageTitle(p)}*\n${durationAndPrice(p)}\n${packageUrl(p.id)}`),
  ].join('\n\n');
  const result = await attemptSend(organizationId, channel, to, text);
  await recordOutbound(organizationId, conversationId, text, result);
  return result;
}

/** Instagram: packages as swipeable cards — photo (or the agency logo), name, duration & price, and a "View package" button. */
async function sendInstagramPackageCards(
  organizationId: string,
  to: string,
  conversationId: string,
  packages: PackageRow[],
): Promise<SendResult | null> {
  const creds = await instagramCreds(organizationId);
  if (!creds) return null;
  const org = await withTenant(organizationId, (tx) => tx.organization.findUnique({ where: { id: organizationId }, select: { logoUrl: true } }));
  const logo = org?.logoUrl && /^https?:\/\//.test(org.logoUrl) ? org.logoUrl : undefined;
  const cards: InstagramCard[] = packages.map((p) => ({
    title: clip(packageTitle(p), 80),
    subtitle: clip(durationAndPrice(p), 80),
    imageUrl: packageImage(p) ?? logo,
    url: packageUrl(p.id),
    buttonTitle: 'View package',
  }));
  const result = await trySend(() => sendInstagramCards(creds.igUserId, creds.accessToken, to, cards));
  if (!result.ok) {
    console.warn('[bot-send] Instagram cards failed, sending text:', result.errorMessage);
    return result;
  }
  const summary = packages.map((p) => `• ${packageTitle(p)} — ${durationAndPrice(p)} — ${packageUrl(p.id)}`).join('\n');
  await recordOutbound(organizationId, conversationId, summary, result, cards[0]?.imageUrl);
  return result;
}
