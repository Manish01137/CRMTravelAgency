import type { Prisma } from '@prisma/client';
import { withTenant } from '../../lib/prisma';
import { decryptJson } from '../../lib/encryption';
import { AppError, NotFound } from '../../lib/errors';
import { metaErrorCode, metaErrorText, listInstagramMedia, replyToInstagramComment, sendInstagramPrivateReply, subscribeInstagramCommentWebhooks } from '../../lib/meta';
import { env } from '../../env';
import { ensureContactConversation } from '../webhooks/webhooks.service';
import type { InstagramCredentials } from '../channels/channels.service';

/**
 * Instagram "comment → DM". Someone comments on a post or ad ("price?",
 * "details") → we send them a DM with the package (Meta's private reply:
 * one per comment, within 7 days), optionally answer the comment publicly,
 * and they become a lead with an Inbox chat. Their reply to the DM opens the
 * normal Instagram chat, where the team / Bot Flow carry on.
 */

export interface RuleMedia {
  id: string;
  caption?: string | null;
  thumbnailUrl?: string | null;
  permalink?: string | null;
}

export interface RuleInput {
  name: string;
  isActive: boolean;
  media: RuleMedia[];
  keywords: string[];
  packageId: string | null;
  dmText: string;
  publicReply: string | null;
}

const SAME_PERSON_WINDOW_MS = 24 * 60 * 60 * 1000;
const packageUrl = (id: string) => `${env.CORS_ORIGIN}/p/${id}`;

async function instagramCredentials(organizationId: string): Promise<InstagramCredentials> {
  const connection = await withTenant(organizationId, (tx) =>
    tx.channelConnection.findUnique({ where: { organizationId_channel: { organizationId, channel: 'INSTAGRAM' } } }),
  );
  if (!connection || connection.status !== 'CONNECTED' || !connection.credentials) {
    throw new AppError(400, 'INSTAGRAM_NOT_CONNECTED', 'Connect Instagram in Settings → Channels first');
  }
  return decryptJson<InstagramCredentials>(connection.credentials);
}

/** Meta refused the comments permission — the account was connected before it was asked for. */
function permissionHelp(err: unknown): never {
  const code = metaErrorCode(err);
  if (code === 10 || code === 200 || code === 3 || /permission/i.test(metaErrorText(err))) {
    throw new AppError(
      403,
      'INSTAGRAM_COMMENTS_PERMISSION',
      'Instagram hasn’t given the CRM access to your comments yet — go to Settings → Channels, disconnect Instagram and connect it again, allowing every permission.',
    );
  }
  throw err;
}

const normalizeKeywords = (k: string[]) => [...new Set(k.map((x) => x.trim().toLowerCase()).filter(Boolean))].slice(0, 30);

// --- Rules (admin) ---------------------------------------------------------------

export async function listRules(organizationId: string) {
  return withTenant(organizationId, (tx) =>
    tx.instagramCommentRule.findMany({
      where: { organizationId },
      include: { package: { select: { id: true, name: true, bannerImageUrl: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  );
}

async function assertPackage(tx: Prisma.TransactionClient, packageId: string | null) {
  if (packageId && !(await tx.package.findUnique({ where: { id: packageId }, select: { id: true } }))) throw NotFound('Package not found');
}

/** Saving an active rule also switches on the comments webhook for the connected account. */
async function ensureSubscribed(organizationId: string) {
  const creds = await instagramCredentials(organizationId);
  await subscribeInstagramCommentWebhooks(creds.accessToken).catch(permissionHelp);
}

export async function createRule(organizationId: string, input: RuleInput) {
  if (input.isActive) await ensureSubscribed(organizationId);
  return withTenant(organizationId, async (tx) => {
    await assertPackage(tx, input.packageId);
    return tx.instagramCommentRule.create({
      data: {
        organizationId,
        name: input.name,
        isActive: input.isActive,
        media: input.media as unknown as Prisma.InputJsonValue,
        keywords: normalizeKeywords(input.keywords),
        packageId: input.packageId,
        dmText: input.dmText,
        publicReply: input.publicReply,
      },
      include: { package: { select: { id: true, name: true, bannerImageUrl: true } } },
    });
  });
}

export async function updateRule(organizationId: string, id: string, input: Partial<RuleInput>) {
  if (input.isActive) await ensureSubscribed(organizationId);
  return withTenant(organizationId, async (tx) => {
    const rule = await tx.instagramCommentRule.findUnique({ where: { id } });
    if (!rule) throw NotFound('Rule not found');
    if (input.packageId !== undefined) await assertPackage(tx, input.packageId);
    return tx.instagramCommentRule.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.media !== undefined && { media: input.media as unknown as Prisma.InputJsonValue }),
        ...(input.keywords !== undefined && { keywords: normalizeKeywords(input.keywords) }),
        ...(input.packageId !== undefined && { packageId: input.packageId }),
        ...(input.dmText !== undefined && { dmText: input.dmText }),
        ...(input.publicReply !== undefined && { publicReply: input.publicReply }),
      },
      include: { package: { select: { id: true, name: true, bannerImageUrl: true } } },
    });
  });
}

export async function deleteRule(organizationId: string, id: string) {
  await withTenant(organizationId, async (tx) => {
    const deleted = await tx.instagramCommentRule.deleteMany({ where: { id } });
    if (!deleted.count) throw NotFound('Rule not found');
  });
}

export async function listMedia(organizationId: string) {
  const creds = await instagramCredentials(organizationId);
  return listInstagramMedia(creds.igUserId, creds.accessToken).catch(permissionHelp);
}

export async function listActivity(organizationId: string) {
  return withTenant(organizationId, (tx) =>
    tx.instagramCommentReply.findMany({
      where: { organizationId },
      include: { rule: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  );
}

// --- The webhook side --------------------------------------------------------------

interface CommentValue {
  id?: string;
  text?: string;
  parent_id?: string;
  from?: { id?: string; username?: string };
  media?: { id?: string; ad_id?: string; ad_title?: string; original_media_id?: string; media_product_type?: string };
}

type RuleRow = Awaited<ReturnType<typeof listRules>>[number];

function ruleMedia(rule: RuleRow): RuleMedia[] {
  return Array.isArray(rule.media) ? (rule.media as unknown as RuleMedia[]) : [];
}

function matches(rule: RuleRow, mediaIds: string[], text: string): boolean {
  const media = ruleMedia(rule);
  if (media.length && !media.some((m) => mediaIds.includes(m.id))) return false;
  const keywords = Array.isArray(rule.keywords) ? (rule.keywords as string[]) : [];
  if (!keywords.length) return true;
  const said = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  return keywords.some((k) => said.includes(` ${k.replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `) || text.toLowerCase().includes(k));
}

export function buildDm(rule: { dmText: string; package: { id: string; name: string } | null }, username: string | null): string {
  const link = rule.package ? packageUrl(rule.package.id) : '';
  let text = rule.dmText.replace(/\{name\}/gi, username ? `@${username}` : 'there').replace(/\{link\}/gi, link);
  if (rule.package && !/\{link\}/i.test(rule.dmText)) text += `\n\n👉 ${rule.package.name}: ${link}`;
  return text.trim().slice(0, 1000);
}

/** One `field: "comments"` change from the Instagram webhook. */
export async function handleInstagramComment(organizationId: string, igAccountId: string, value: CommentValue): Promise<void> {
  const commentId = String(value.id ?? '');
  const fromId = String(value.from?.id ?? '');
  if (!commentId || !fromId || fromId === igAccountId) return; // our own replies come back as comments too
  const username = value.from?.username ?? null;
  const text = String(value.text ?? '').trim();
  const media = value.media ?? {};
  const mediaIds = [media.id, media.original_media_id, media.ad_id].filter((x): x is string => !!x);
  const isAd = !!media.ad_id;

  const rules = await withTenant(organizationId, (tx) =>
    tx.instagramCommentRule.findMany({
      where: { organizationId, isActive: true },
      include: { package: { select: { id: true, name: true, bannerImageUrl: true } } },
      orderBy: { createdAt: 'asc' },
    }),
  );
  // Rules for these exact posts win over "every post" rules.
  const rule =
    rules.find((r) => ruleMedia(r).length > 0 && matches(r, mediaIds, text)) ?? rules.find((r) => ruleMedia(r).length === 0 && matches(r, mediaIds, text));
  if (!rule) return;

  // Claim the comment (Meta re-delivers webhooks; one DM per comment).
  const log = await withTenant(organizationId, async (tx) => {
    if (await tx.instagramCommentReply.findUnique({ where: { commentId } })) return null;
    const recent = await tx.instagramCommentReply.findFirst({
      where: { igUserId: fromId, mediaId: media.id ?? null, status: 'SENT', createdAt: { gt: new Date(Date.now() - SAME_PERSON_WINDOW_MS) } },
    });
    return tx.instagramCommentReply.create({
      data: {
        organizationId,
        ruleId: rule.id,
        commentId,
        mediaId: media.id ?? null,
        adId: media.ad_id ?? null,
        igUserId: fromId,
        username,
        commentText: text.slice(0, 1000),
        status: recent ? 'SKIPPED' : 'FAILED',
        error: recent ? 'Already sent this person a DM for this post today' : 'Sending…',
      },
    });
  }).catch((err) => {
    if ((err as { code?: string }).code === 'P2002') return null;
    throw err;
  });
  if (!log || log.status === 'SKIPPED') return;

  const dm = buildDm(rule, username);
  try {
    const creds = await instagramCredentials(organizationId);
    const sent = await sendInstagramPrivateReply(creds.igUserId, creds.accessToken, commentId, dm);
    if (rule.publicReply?.trim()) {
      await replyToInstagramComment(commentId, creds.accessToken, rule.publicReply.trim()).catch((err) =>
        console.warn('[ig-comments] public reply failed:', err instanceof Error ? err.message : err),
      );
    }
    await withTenant(organizationId, async (tx) => {
      // The commenter becomes a lead with an Instagram chat (no 24h window yet — that opens when they reply).
      const { conversation } = await ensureContactConversation(tx, {
        organizationId,
        channel: 'INSTAGRAM',
        externalContactId: fromId,
        contactName: username ? `@${username}` : null,
        contactPhone: null,
        leadSource: isAd ? 'INSTAGRAM_ADS' : 'INSTAGRAM',
      });
      if (rule.packageId && conversation.leadId) {
        await tx.lead.updateMany({ where: { id: conversation.leadId, packageId: null }, data: { packageId: rule.packageId } });
      }
      const note = `💬 Commented on your ${isAd ? 'ad' : 'post'}: “${text.slice(0, 300)}”`;
      await tx.message.create({ data: { organizationId, conversationId: conversation.id, direction: 'OUTBOUND', body: note, status: 'SENT', sentById: null } });
      await tx.message.create({
        data: { organizationId, conversationId: conversation.id, direction: 'OUTBOUND', body: dm, externalMessageId: sent.externalMessageId, status: 'SENT', sentById: null },
      });
      await tx.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date(), lastMessagePreview: dm.slice(0, 200) } });
      await tx.instagramCommentReply.update({ where: { id: log.id }, data: { status: 'SENT', error: null, conversationId: conversation.id } });
      await tx.instagramCommentRule.update({ where: { id: rule.id }, data: { sentCount: { increment: 1 } } });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not send the DM';
    console.error('[ig-comments] private reply failed:', message);
    await withTenant(organizationId, (tx) => tx.instagramCommentReply.update({ where: { id: log.id }, data: { status: 'FAILED', error: message.slice(0, 500) } }));
  }
}
