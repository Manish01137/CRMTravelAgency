import { withTenant } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/errors';
import { advanceBotFlow } from './bot-flow.engine';
import { START_WINDOW_MS, loadFlowRouting } from './bot-flow.triggers';

/**
 * The Inbox's view of the bot on one chat, and the agent's controls over it:
 * restart the flow from the beginning, or pause it while the team takes over.
 */

export type ChatBotState =
  | { state: 'off' }
  | {
      state: 'waiting' | 'running' | 'finished' | 'paused';
      flowId: string;
      flowName: string;
      /** The question the bot is waiting on (state 'waiting'). */
      question: string | null;
    };

export async function getChatBotState(organizationId: string, conversationId: string): Promise<ChatBotState> {
  return withTenant(organizationId, async (tx) => {
    const session = await tx.botFlowSession.findUnique({ where: { conversationId }, include: { flow: { select: { id: true, name: true } } } });
    if (!session) return { state: 'off' };
    const step = session.currentStepId ? await tx.botFlowStep.findUnique({ where: { id: session.currentStepId }, select: { question: true } }) : null;
    const state =
      session.status === 'NEEDS_REVIEW' ? 'paused' : session.status === 'COMPLETED' ? 'finished' : session.currentStepId ? 'waiting' : 'running';
    return { state, flowId: session.flow.id, flowName: session.flow.name, question: step?.question ?? null };
  });
}

export async function controlChatBot(organizationId: string, conversationId: string, action: 'restart' | 'pause'): Promise<ChatBotState> {
  const latestInbound = await withTenant(organizationId, async (tx) => {
    const conversation = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) throw NotFound('Conversation not found');
    if (conversation.channel !== 'WHATSAPP' && conversation.channel !== 'INSTAGRAM') throw BadRequest('The bot only runs on WhatsApp and Instagram');
    const session = await tx.botFlowSession.findUnique({ where: { conversationId } });

    if (action === 'pause') {
      if (!session) throw BadRequest('The bot isn’t running on this chat');
      await tx.botFlowSession.update({ where: { id: session.id }, data: { status: 'NEEDS_REVIEW' } });
      return null;
    }

    // Restart: the channel's default flow, else the flow this chat was in.
    const routing = await loadFlowRouting(tx, organizationId, conversation.channel);
    const previous = session ? await tx.botFlow.findUnique({ where: { id: session.flowId }, select: { id: true, isActive: true } }) : null;
    const flowId = routing.defaultFlowId ?? (previous?.isActive ? previous.id : null);
    if (!flowId) throw BadRequest('No flow to run — set a default flow for this channel on the Bot Flows page');
    await tx.botFlowSession.upsert({
      where: { conversationId },
      create: { organizationId, conversationId, flowId, status: 'ACTIVE' },
      update: { flowId, status: 'ACTIVE', currentStepId: null, collectedData: {} },
    });
    if (conversation.leadId) {
      await tx.lead.updateMany({ where: { id: conversation.leadId, organizationId }, data: { needsReview: false, needsReviewReason: null } });
    }
    const latest = await tx.message.findFirst({ where: { conversationId, direction: 'INBOUND' }, orderBy: { createdAt: 'desc' } });
    if (latest && Date.now() - latest.createdAt.getTime() >= START_WINDOW_MS) {
      // Too old to answer — wait for their next message instead.
      await tx.botFlowSession.update({ where: { conversationId }, data: { lastProcessedMessageAt: latest.createdAt } });
    }
    return latest;
  });

  // Start the flow right away when the customer wrote recently (WhatsApp only
  // allows a free-form reply within 24h); otherwise it starts on their next message.
  if (action === 'restart' && latestInbound && Date.now() - latestInbound.createdAt.getTime() < START_WINDOW_MS) {
    await advanceBotFlow(organizationId, conversationId, latestInbound.body ?? '', latestInbound.createdAt, latestInbound.interactiveSelectionId);
  }
  return getChatBotState(organizationId, conversationId);
}
