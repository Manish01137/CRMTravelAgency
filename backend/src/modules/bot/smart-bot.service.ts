import { withTenant } from '../../lib/prisma';
import { attemptSend, recordOutbound, sendPackage, sendPackageCarousel } from '../bot-flow/bot-send';
import { loadAgentContext } from '../ai-agent/ai-agent.service';
import { classifyBotIntent, DEFAULT_GEMINI_MODEL } from '../../lib/gemini';
import { TOOL_DECLARATIONS, runBotTool } from './tools';
import { matchPackagesInText } from '../../lib/packageMatch';
import { isPlaceholderBody, isReactionBody, TYPE_YOUR_REPLY } from '../../lib/whatsappInbound';

/**
 * Smart Bot — webhook-inline WhatsApp bot (POC), feature-flagged per
 * organization via SmartBotSettings. Called directly from
 * webhooks.service.ts's processWhatsAppEntry, right after recordInbound —
 * unlike Bot Flow (backend/src/modules/bot-flow), which is a separate,
 * poller-driven visual-flow engine that advances BotFlowSession rows on its
 * own schedule. The two are DELIBERATELY never allowed to run for the same
 * organization at once: both would otherwise try to answer the same inbound
 * message, so an org with a Bot Flow assigned to WhatsApp always wins — see
 * the guard below. Reuses Bot Flow's own send/record primitives
 * (attemptSend/recordOutbound) rather than re-implementing them.
 */

export interface SmartBotInboundContext {
  conversationId: string;
  leadId: string | null;
  /** True when recordInbound just created this conversation (i.e. this is the contact's first-ever message on this channel). */
  isNewConversation: boolean;
}

export interface SmartBotInboundMessage {
  phone: string;
  text: string;
}

export async function runSmartBotForWhatsApp(
  organizationId: string,
  conv: SmartBotInboundContext,
  msg: SmartBotInboundMessage,
): Promise<void> {
  const leadId = conv.leadId;
  if (!leadId) return; // recordInbound always attaches a lead for WhatsApp — nothing to do without one

  const settings = await withTenant(organizationId, (tx) => tx.smartBotSettings.findUnique({ where: { organizationId } }));
  if (!settings?.enabled) return;

  // Mutually exclusive with Bot Flow for this org+channel — see file comment.
  const botFlowAssigned = await withTenant(organizationId, (tx) =>
    tx.botFlowAssignment.findUnique({ where: { organizationId_channel: { organizationId, channel: 'WHATSAPP' } } }),
  );
  if (botFlowAssigned) {
    console.warn(
      `[smart-bot] org ${organizationId} has Smart Bot enabled AND a Bot Flow assigned to WhatsApp — deferring to Bot Flow, skipping this message to avoid a double reply.`,
    );
    return;
  }

  await logInteraction(organizationId, leadId, 'inbound', msg.text, null);

  if (conv.isNewConversation) {
    await handleNewLead(organizationId, conv, leadId, msg);
  } else {
    await handleExistingLead(organizationId, conv, leadId, msg);
  }
}

async function logInteraction(
  organizationId: string,
  leadId: string,
  direction: 'inbound' | 'outbound',
  rawMessage: string,
  matchedTool: string | null,
): Promise<void> {
  await withTenant(organizationId, (tx) =>
    tx.botInteractionLog.create({ data: { organizationId, leadId, direction, rawMessage, matchedTool: matchedTool ?? undefined } }),
  );
}

/** Sends via Bot Flow's own send/record primitives, then logs it as this lead's outbound bot turn. */
async function reply(
  organizationId: string,
  conv: SmartBotInboundContext,
  leadId: string,
  phone: string,
  text: string,
  matchedTool: string | null,
): Promise<void> {
  const result = await attemptSend(organizationId, 'WHATSAPP', phone, text);
  await recordOutbound(organizationId, conv.conversationId, text, result);
  await logInteraction(organizationId, leadId, 'outbound', text, matchedTool);
}

/**
 * Brand-new lead's first message: send exactly one greeting, then stop. No
 * intent classification runs on this first message. (A message from a
 * linked ad never gets here — webhooks.service.ts sends that ad's package as
 * the reply instead, and lead attribution happens in recordInbound.)
 *
 * The updateMany below is an ATOMIC claim, not a read-then-write: two
 * concurrent webhook deliveries for the same brand-new number (Meta can and
 * does redeliver) would otherwise both see hasGreeted=false and both send a
 * greeting. Only the delivery whose UPDATE actually flips a row (count > 0)
 * proceeds — the other sees count===0 and returns, exactly mirroring
 * webhooks.service.ts's own comment on why Conversation creation uses
 * upsert instead of a separate check-then-create.
 */
async function handleNewLead(
  organizationId: string,
  conv: SmartBotInboundContext,
  leadId: string,
  msg: SmartBotInboundMessage,
): Promise<void> {
  const claimed = await withTenant(organizationId, (tx) =>
    tx.lead.updateMany({ where: { id: leadId, organizationId, hasGreeted: false }, data: { hasGreeted: true } }),
  );
  if (claimed.count === 0) return; // another concurrent delivery already claimed this greeting

  const greeting = `Hi! 👋 Thanks for reaching out — how can I help you plan your next trip?`;
  await reply(organizationId, conv, leadId, msg.phone, greeting, null);
}

/**
 * Existing lead, free-text message. Order matters:
 *   1. Deterministic package match against the org's own active packages —
 *      if the message already names one, send it straight away. No Gemini
 *      call, works even for orgs with no Gemini key configured at all.
 *      Covers "send me the package" and "send me the itinerary" alike,
 *      since both mean "send buildPackageContent" in this system.
 *   2. Only when nothing matches does Gemini classify the message into one
 *      of the other tools (payment details, handoff, etc.).
 */
async function handleExistingLead(
  organizationId: string,
  conv: SmartBotInboundContext,
  leadId: string,
  msg: SmartBotInboundMessage,
): Promise<void> {
  const fallback = "Sorry, I didn't quite understand that — would you like to speak with an agent?";

  // A voice note / sticker / message WhatsApp won't share arrives as a
  // [label] — nothing to classify. Ask for a typed reply; let reactions pass.
  if (isPlaceholderBody(msg.text)) {
    if (!isReactionBody(msg.text)) await reply(organizationId, conv, leadId, msg.phone, TYPE_YOUR_REPLY, null);
    return;
  }

  try {
    const packages = await withTenant(organizationId, (tx) =>
      tx.package.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true, destination: true }, take: 50 }),
    );

    // Named one of our packages → send it (photo + details); several → carousel.
    const matched = matchPackagesInText(msg.text, packages);
    if (matched.length > 0) {
      const result =
        matched.length === 1
          ? await sendPackage(organizationId, 'WHATSAPP', msg.phone, conv.conversationId, matched[0].id)
          : await sendPackageCarousel(organizationId, 'WHATSAPP', msg.phone, conv.conversationId, matched.map((p) => p.id), 'I found a few matching packages 👇');
      if (result) {
        await logInteraction(organizationId, leadId, 'outbound', matched.map((p) => p.name).join(', '), 'keyword_match');
        return;
      }
    }

    const agent = await loadAgentContext(organizationId);
    if (!agent) {
      // No Gemini key configured for this org — can't classify; hand off rather than stay silent.
      await reply(organizationId, conv, leadId, msg.phone, fallback, 'handoff_to_human');
      return;
    }

    const call = await classifyBotIntent(agent.apiKey, DEFAULT_GEMINI_MODEL, msg.text, packages.map((p) => p.name), TOOL_DECLARATIONS);

    if (!call) {
      await reply(organizationId, conv, leadId, msg.phone, fallback, null);
      return;
    }

    const result = await runBotTool(organizationId, call.name, call.args);
    await reply(organizationId, conv, leadId, msg.phone, result.reply, call.name);
  } catch (err) {
    console.error('[smart-bot] handleExistingLead failed, falling back:', err instanceof Error ? err.message : err);
    await reply(organizationId, conv, leadId, msg.phone, fallback, 'handoff_to_human');
  }
}
