import { systemPrisma, type TenantTx } from '../../lib/prisma';
import { advanceBotFlow } from './bot-flow.engine';
import {
  botFlowInUse,
  chooseFlowForGreeting,
  chooseFlowForNewChat,
  chooseFlowForRestart,
  loadFlowRouting,
  type FlowRouting,
} from './bot-flow.triggers';

/**
 * Runs the bot for a chat's newest inbound message. Called straight from the
 * webhook the moment a message arrives (so the reply goes out in a second or
 * two), and by the 10s poller as a backup for anything missed.
 *
 * Both can reach the same chat at once, so each chat is handled one run at a
 * time (runExclusive), and every run re-reads the session first — the second
 * one sees the message already handled and does nothing. One backend process
 * runs both, so an in-memory lock is enough.
 */

const running = new Map<string, Promise<void>>();

function runExclusive(key: string, fn: () => Promise<void>): Promise<void> {
  const previous = running.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn).finally(() => {
    if (running.get(key) === next) running.delete(key);
  });
  running.set(key, next);
  return next;
}

/** A finished or teammate-owned chat only wakes the bot with a keyword, "hi", or (finished) the AI assistant. */
function shouldRun(
  routing: FlowRouting,
  session: { status: string; flowId: string; lastProcessedMessageAt: Date | null } | null,
  latest: { body: string | null; createdAt: Date },
  sourceAdId: string | null | undefined,
): boolean {
  if (session?.lastProcessedMessageAt && session.lastProcessedMessageAt >= latest.createdAt) return false;
  const body = latest.body ?? '';
  const greeting = !!chooseFlowForGreeting(routing, body, session?.flowId ?? null, latest.createdAt);
  if (session?.status === 'NEEDS_REVIEW') return greeting;
  if (session?.status === 'COMPLETED') {
    return greeting || !!chooseFlowForRestart(routing, body, latest.createdAt) || routing.aiFollowUp.has(session.flowId);
  }
  if (!session) return !!chooseFlowForNewChat(routing, body, sourceAdId, latest.createdAt);
  return true; // ACTIVE
}

export function processConversation(organizationId: string, conversationId: string, routing?: FlowRouting): Promise<void> {
  return runExclusive(conversationId, async () => {
    const conversation = await systemPrisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { where: { direction: 'INBOUND' }, orderBy: { createdAt: 'desc' }, take: 1 },
        botFlowSession: true,
        lead: { select: { sourceAdId: true } },
      },
    });
    if (!conversation || conversation.organizationId !== organizationId) return;
    if (conversation.channel !== 'WHATSAPP' && conversation.channel !== 'INSTAGRAM') return;
    const latest = conversation.messages[0];
    if (!latest) return;

    const flowRouting = routing ?? (await loadFlowRouting(systemPrisma as unknown as TenantTx, organizationId, conversation.channel));
    if (!botFlowInUse(flowRouting)) return;
    if (!shouldRun(flowRouting, conversation.botFlowSession, latest, conversation.lead?.sourceAdId)) return;

    await advanceBotFlow(organizationId, conversation.id, latest.body ?? '', latest.createdAt, latest.interactiveSelectionId);
  });
}

/** From the webhook: answer this chat now, in the background — never delays or breaks the webhook itself. */
export function triggerBotFlowNow(organizationId: string, conversationId: string): void {
  void (async () => {
    const connection = await systemPrisma.conversation.findUnique({ where: { id: conversationId }, select: { channel: true } });
    if (!connection) return;
    const channelConnection = await systemPrisma.channelConnection.findUnique({
      where: { organizationId_channel: { organizationId, channel: connection.channel } },
      select: { status: true },
    });
    if (channelConnection?.status !== 'CONNECTED') return;
    await processConversation(organizationId, conversationId);
  })().catch((err) => console.error('[bot-flow] instant run failed (the poller will retry):', err instanceof Error ? err.message : err));
}
