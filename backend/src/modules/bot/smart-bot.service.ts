import { withTenant } from '../../lib/prisma';
import { attemptSend, recordOutbound } from '../bot-flow/bot-flow.engine';
import { loadAgentContext } from '../ai-agent/ai-agent.service';
import { classifyBotIntent, DEFAULT_GEMINI_MODEL } from '../../lib/gemini';
import { TOOL_DECLARATIONS, runBotTool } from './tools';

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
  /** Meta's referral.source_id from a Click-to-WhatsApp ad, present only on a new contact's first message. */
  adId: string | null;
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
 * Brand-new lead's first message: send exactly one greeting — referencing
 * the ad-mapped package if the referral's source_id matched an
 * AdPackageMapping, generic otherwise — then stop. No intent classification
 * runs on this first message.
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

  let sourcePackage: { id: string; name: string } | null = null;
  if (msg.adId) {
    const mapping = await withTenant(organizationId, (tx) =>
      tx.adPackageMapping.findUnique({
        where: { organizationId_adId: { organizationId, adId: msg.adId! } },
        include: { package: { select: { id: true, name: true } } },
      }),
    );
    sourcePackage = mapping?.package ?? null;
  }

  if (sourcePackage) {
    await withTenant(organizationId, (tx) =>
      tx.lead.update({ where: { id: leadId }, data: { sourceAdId: msg.adId, sourcePackageId: sourcePackage!.id } }),
    );
  } else if (msg.adId) {
    // Ad click with no configured mapping yet — still record which ad it was, just no package attribution.
    await withTenant(organizationId, (tx) => tx.lead.update({ where: { id: leadId }, data: { sourceAdId: msg.adId } }));
  }

  const greeting = sourcePackage
    ? `Hi! 👋 Thanks for reaching out about our *${sourcePackage.name}* package. How can I help you plan this trip?`
    : `Hi! 👋 Thanks for reaching out — how can I help you plan your next trip?`;

  await reply(organizationId, conv, leadId, msg.phone, greeting, null);
}

/** Existing lead, free-text message: Gemini routes to a tool (or doesn't), the tool's own deterministic reply gets sent. */
async function handleExistingLead(
  organizationId: string,
  conv: SmartBotInboundContext,
  leadId: string,
  msg: SmartBotInboundMessage,
): Promise<void> {
  const fallback = "Sorry, I didn't quite understand that — would you like to speak with an agent?";

  try {
    const agent = await loadAgentContext(organizationId);
    if (!agent) {
      // No Gemini key configured for this org — can't classify; hand off rather than stay silent.
      await reply(organizationId, conv, leadId, msg.phone, fallback, 'handoff_to_human');
      return;
    }

    const packages = await withTenant(organizationId, (tx) =>
      tx.package.findMany({ where: { organizationId, isActive: true }, select: { name: true }, take: 50 }),
    );

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
