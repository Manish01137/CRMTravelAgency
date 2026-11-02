import { Queue, Worker, type Job } from 'bullmq';
import { getRedisConnection } from '../lib/redis';
import { systemPrisma, type TenantTx } from '../lib/prisma';
import { processConversation } from '../modules/bot-flow/bot-flow.runner';
import {
  botFlowInUse,
  chooseFlowForGreeting,
  chooseFlowForNewChat,
  chooseFlowForRestart,
  loadFlowRouting,
  settingsFlowId,
} from '../modules/bot-flow/bot-flow.triggers';

/**
 * Reacts to new inbound WhatsApp/Instagram messages for orgs using Bot Flow
 * (a default flow on a channel, or keyword / ad-triggered flows) WITHOUT touching Phase 3's webhooks.service.ts. Runs as a
 * BullMQ repeatable job (every 30s): scans across all organizations for
 * unprocessed inbound messages (cross-org discovery via systemPrisma — same
 * "resolve before an org context exists" pattern webhooks.service.ts itself
 * documents), then hands each one to bot-flow.engine.ts, which does all its
 * actual reads/writes through `withTenant` — RLS enforces isolation for
 * every row that's touched, exactly like every other module.
 */

const QUEUE_NAME = 'bot-flow-poll';
const JOB_NAME = 'scan';
// Backup only — replies go out straight from the webhook (bot-flow.runner.ts).
// Every scan reads the database, so it stays slow and narrow: the database is
// billed by data transferred, and this used to be most of it.
const POLL_INTERVAL_MS = 30_000;
// This poller only catches messages the webhook missed (a deploy restart, a
// dropped instant run) — those are minutes old, never days.
const RECENT_WINDOW_MS = 6 * 60 * 60 * 1000;
// Room for clock differences between this server (lastInboundAt) and the database (messages.created_at).
const CLOCK_SLACK_MS = 10 * 60 * 1000;

let queue: Queue | null = null;
let worker: Worker | null = null;

async function scan(): Promise<void> {
  // Orgs using Bot Flow at all: a default flow on a channel, or any active flow with triggers.
  const [assignments, triggeredFlows] = await Promise.all([
    systemPrisma.botFlowAssignment.findMany({ select: { organizationId: true } }),
    systemPrisma.botFlow.findMany({
      where: { isActive: true, OR: [{ NOT: { triggerKeywords: { equals: [] } } }, { NOT: { triggerAdIds: { equals: [] } } }] },
      select: { organizationId: true },
    }),
  ]);
  const orgIds = [...new Set([...assignments, ...triggeredFlows].map((r) => r.organizationId))];

  for (const organizationId of orgIds) {
    for (const channel of ['WHATSAPP', 'INSTAGRAM'] as const) {
      try {
        await scanChannel(organizationId, channel);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Bot Flow poller: failed to scan', organizationId, channel, err instanceof Error ? err.message : err);
      }
    }
  }
}

async function scanChannel(organizationId: string, channel: 'WHATSAPP' | 'INSTAGRAM'): Promise<void> {
  const connection = await systemPrisma.channelConnection.findUnique({
    where: { organizationId_channel: { organizationId, channel } },
    select: { status: true },
  });
  if (!connection || connection.status !== 'CONNECTED') return;

  const routing = await loadFlowRouting(systemPrisma as unknown as TenantTx, organizationId, channel);
  if (!botFlowInUse(routing)) return;

  // Only what the pre-checks below read — processConversation loads the chat again itself.
  // `take: 1` on a relation in a findMany is applied in memory by Prisma (the SQL has
  // no LIMIT), so the messages are also bounded by date: only this window's inbound ones.
  const since = Date.now() - RECENT_WINDOW_MS;
  const conversations = await systemPrisma.conversation.findMany({
    where: { organizationId, channel, lastInboundAt: { gte: new Date(since) } },
    select: {
      id: true,
      messages: {
        where: { direction: 'INBOUND', createdAt: { gte: new Date(since - CLOCK_SLACK_MS) } },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { body: true, createdAt: true },
      },
      botFlowSession: { select: { status: true, flowId: true, lastProcessedMessageAt: true } },
      lead: { select: { sourceAdId: true } },
    },
  });

  for (const conversation of conversations) {
    const latestInbound = conversation.messages[0];
    if (!latestInbound) continue;
    const session = conversation.botFlowSession;
    if (session?.lastProcessedMessageAt && session.lastProcessedMessageAt >= latestInbound.createdAt) continue;
    const body = latestInbound.body ?? '';
    // Cheap pre-checks so chats no flow applies to aren't loaded on every scan.
    // A finished or teammate-owned chat only wakes the bot with a keyword or "hi".
    const flowId = session ? settingsFlowId(routing, session.flowId) : null;
    const greeting = !!chooseFlowForGreeting(routing, body, flowId, latestInbound.createdAt);
    // Handed over: "hi", or the AI assistant (it checks whether a teammate is replying).
    if (session?.status === 'NEEDS_REVIEW' && !greeting && !routing.aiFollowUp.has(flowId!)) continue;
    if (
      session?.status === 'COMPLETED' &&
      !greeting &&
      !chooseFlowForRestart(routing, body, latestInbound.createdAt) &&
      !routing.aiFollowUp.has(flowId!)
    ) continue;
    if (!session && !chooseFlowForNewChat(routing, body, conversation.lead?.sourceAdId, latestInbound.createdAt)) continue;

    try {
      // Same runner the webhook uses — one run per chat at a time, so the two never answer twice.
      await processConversation(organizationId, conversation.id, routing);
    } catch (err) {
      // One conversation's failure must never stop the rest of the scan.
      // eslint-disable-next-line no-console
      console.error('Bot Flow poller: failed to advance conversation', conversation.id, err instanceof Error ? err.message : err);
    }
  }
}

/** Called once at server startup (gated on REDIS_URL) to start scheduling + processing. */
export async function startBotFlowPoller(): Promise<void> {
  const connection = getRedisConnection();
  queue = new Queue(QUEUE_NAME, { connection });
  await queue.upsertJobScheduler(JOB_NAME, { every: POLL_INTERVAL_MS }, { opts: { removeOnComplete: true, removeOnFail: 50 } });

  worker = new Worker(QUEUE_NAME, async (_job: Job) => scan(), { connection, concurrency: 1 });
  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error('Bot Flow poller job failed:', job?.id, err.message);
  });
}

export async function stopBotFlowPoller(): Promise<void> {
  await worker?.close();
  await queue?.close();
}

/** Test/manual-trigger hook — runs one scan pass immediately, outside the schedule. */
export const runBotFlowScanOnce = scan;
