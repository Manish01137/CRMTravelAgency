import { withTenant } from '../../lib/prisma';
import { DEFAULT_GEMINI_MODEL, runFollowUpAssistant, type CatalogPackage, type FollowUpResult } from '../../lib/gemini';
import { loadAgentContext } from '../ai-agent/ai-agent.service';
import { matchPackagesInText } from '../../lib/packageMatch';
import { isPlaceholderBody } from '../../lib/whatsappInbound';
import { validateAnswer } from '../../lib/answerValidation';
import { attemptSend, recordOutbound, sendPackage, sendPackageCarousel } from './bot-send';
import { START_WINDOW_MS } from './bot-flow.triggers';

/**
 * A finished Bot Flow chat that gets a new real request ("we are 4, Manali on
 * 26 November, send me the package") — the AI assistant looks after it:
 *   - saves what they told us to the lead (destination, travellers, date, email);
 *   - sends the matching packages from the CRM (one as a photo + details,
 *     several as a carousel), introduced by a short reply;
 *   - no matching package, or a question it can't answer from the package
 *     details: a polite reply and the chat goes to the team (Needs review);
 *   - "ok", "thanks", emojis: no reply.
 * Without a Gemini key it still sends packages named in the message.
 */

const CATALOG_LIMIT = 50;

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export async function runAiFollowUp(
  organizationId: string,
  conversationId: string,
  sessionId: string,
  messageBody: string,
  messageCreatedAt: Date,
): Promise<void> {
  try {
    if (isPlaceholderBody(messageBody) || !messageBody.trim()) return; // voice note / sticker / reaction
    if (isAcknowledgement(messageBody)) return; // "ok", "thanks", 👍 — nothing to answer, no AI call
    if (Date.now() - messageCreatedAt.getTime() > START_WINDOW_MS) return; // too old to reply to

    const loaded = await withTenant(organizationId, async (tx) => {
      const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation || (conversation.channel !== 'WHATSAPP' && conversation.channel !== 'INSTAGRAM')) return null;
      const packages = await tx.package.findMany({
        where: { organizationId, isActive: true },
        select: {
          id: true,
          name: true,
          destination: true,
          days: true,
          nights: true,
          priceAmount: true,
          priceCurrency: true,
          whatsappDescription: true,
          description: true,
          inclusions: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: CATALOG_LIMIT,
      });
      const recent = await tx.message.findMany({ where: { conversationId }, orderBy: { createdAt: 'desc' }, take: 12 });
      return { conversation, packages, recent: recent.reverse() };
    });
    if (!loaded) return;
    const { conversation, packages } = loaded;
    const channel = conversation.channel as 'WHATSAPP' | 'INSTAGRAM';
    const to = conversation.externalContactId;

    const agent = await loadAgentContext(organizationId).catch(() => null);
    let result: FollowUpResult | null = null;
    if (agent) {
      const history = loaded.recent
        .filter((m) => m.body && m.createdAt < messageCreatedAt)
        .map((m) => ({ direction: m.direction, body: m.body as string }));
      // Only what the AI needs (the input is most of the cost):
      //  - this message names packages/places → only those, with full details;
      //  - otherwise → packages the last few messages were about (e.g. a
      //    question about the one just sent) with details, plus every other
      //    package on one line (name, place, days, price, a few words) so a
      //    theme like "desert trips" still finds Jaisalmer.
      // Short ids (P1, P2…) instead of 36-character ids, mapped back below.
      const named = matchPackagesInText(messageBody, packages).slice(0, 5);
      const discussed = named.length > 0 ? [] : matchPackagesInText(history.slice(-4).map((t) => t.body).join('\n'), packages).slice(0, 3);
      const detailed = new Set([...named, ...discussed].map((p) => p.id));
      const inCatalog = named.length > 0 ? named : [...discussed, ...packages.filter((p) => !detailed.has(p.id))];
      const shortIds = new Map(inCatalog.map((p, i) => [`P${i + 1}`, p.id]));
      const catalog: CatalogPackage[] = inCatalog.map((p, i) => ({
        id: `P${i + 1}`,
        name: p.name,
        destination: p.destination,
        days: p.days,
        nights: p.nights,
        price: p.priceAmount ? money(p.priceAmount, p.priceCurrency) : 'price on request',
        summary: detailed.has(p.id)
          ? [p.whatsappDescription || p.description, p.inclusions && `Includes: ${p.inclusions.replace(/\n+/g, ', ')}`]
              .filter(Boolean)
              .join(' ')
              .replace(/\s+/g, ' ')
              .slice(0, 300)
          : clipWords(p.whatsappDescription || p.description || '', 60),
      }));
      result = await runFollowUpAssistant(agent.apiKey, DEFAULT_GEMINI_MODEL, agent, catalog, history, messageBody)
        .then((r) => ({ ...r, packageIds: r.packageIds.map((id) => shortIds.get(id)).filter((id): id is string => !!id) }))
        .catch((err) => {
          console.error('[bot-flow] AI follow-up failed, using package-name matching:', err instanceof Error ? err.message : err);
          return null;
        });
    }

    if (!result) {
      // No AI (no key, or it failed): packages named in the message still go out.
      const named = matchPackagesInText(messageBody, packages);
      if (named.length > 0) result = { intent: 'package', packageIds: named.slice(0, 5).map((p) => p.id), reply: '', handoff: false, lead: {} };
      else return;
    }

    if (conversation.leadId) await saveLeadDetails(organizationId, conversation.leadId, result.lead);

    if (result.intent === 'package' && result.packageIds.length > 0) {
      if (result.packageIds.length === 1) {
        if (result.reply) await sendText(organizationId, channel, to, conversationId, result.reply);
        await sendPackage(organizationId, channel, to, conversationId, result.packageIds[0]);
      } else {
        await sendPackageCarousel(organizationId, channel, to, conversationId, result.packageIds, result.reply || 'Here are our packages for you 👇');
      }
    } else if (result.reply && (result.intent !== 'other' || result.handoff)) {
      await sendText(organizationId, channel, to, conversationId, result.reply);
    }

    if (result.handoff) {
      const reason = `AI assistant: ${result.intent === 'package' ? 'no matching package' : "couldn't answer from the package details"} — "${messageBody.slice(0, 120)}"`;
      await withTenant(organizationId, async (tx) => {
        await tx.botFlowSession.update({ where: { id: sessionId }, data: { status: 'NEEDS_REVIEW' } });
        if (conversation.leadId) {
          await tx.lead.updateMany({ where: { id: conversation.leadId, organizationId }, data: { needsReview: true, needsReviewReason: reason } });
        }
      });
    }
  } finally {
    await withTenant(organizationId, (tx) =>
      tx.botFlowSession.updateMany({ where: { id: sessionId }, data: { lastProcessedMessageAt: messageCreatedAt } }),
    ).catch(() => undefined);
  }
}

/** The first ~max characters, ending on a whole word. */
function clipWords(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 0) || max);
}

// "ok", "thanks", "👍", "ok thank you sir", "theek hai" — acknowledgements, not requests.
const ACK_WORDS = new Set(
  'ok okay okk k kk okie fine thanks thank thanku thankyou thx ty you so much very great nice cool done sure alright noted perfect awesome good hmm hm haan ha han ji sir madam mam bhai theek thik hai accha achha acha shukriya dhanyavad welcome bye got it'.split(' '),
);
function isAcknowledgement(message: string): boolean {
  const words = message.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return true; // only emojis / punctuation
  return words.length <= 6 && words.every((w) => ACK_WORDS.has(w.replace(/(.)\1{2,}/g, '$1$1')));
}

async function sendText(organizationId: string, channel: 'WHATSAPP' | 'INSTAGRAM', to: string, conversationId: string, text: string) {
  const result = await attemptSend(organizationId, channel, to, text);
  await recordOutbound(organizationId, conversationId, text, result);
}

/** What they told us goes onto the lead — only details they stated, and only valid ones. */
async function saveLeadDetails(organizationId: string, leadId: string, lead: FollowUpResult['lead']): Promise<void> {
  const data: Record<string, unknown> = {};
  if (lead.destination) data.destination = lead.destination.slice(0, 120);
  if (lead.travelerCount && lead.travelerCount <= 1000) data.travelerCount = lead.travelerCount;
  if (lead.travelDate) {
    const d = validateAnswer('date', lead.travelDate);
    if (d.ok) data.travelDate = d.value;
  }
  if (lead.email) {
    const e = validateAnswer('email', lead.email);
    if (e.ok) data.email = e.value;
  }
  await withTenant(organizationId, async (tx) => {
    const current = await tx.lead.findUnique({ where: { id: leadId }, select: { name: true, phone: true } });
    // Only replace a name that's just a phone number — never the one already on the lead.
    if (lead.name && current && (/^\+?[\d\s-]+$/.test(current.name) || current.name === current.phone)) data.name = lead.name.slice(0, 120);
    if (Object.keys(data).length > 0) await tx.lead.updateMany({ where: { id: leadId, organizationId }, data });
  });
}
