import { Queue, Worker, type Job } from 'bullmq';
import { getRedisConnection } from '../lib/redis';
import { systemPrisma } from '../lib/prisma';
import { advanceBotFlow } from '../modules/bot-flow/bot-flow.engine';

/**
 * Reacts to new inbound WhatsApp/Instagram messages on bot-assigned
 * conversations WITHOUT touching Phase 3's webhooks.service.ts. Runs as a
 * BullMQ repeatable job (every 10s): scans across all organizations for
 * unprocessed inbound messages (cross-org discovery via systemPrisma — same
 * "resolve before an org context exists" pattern webhooks.service.ts itself
 * documents), then hands each one to bot-flow.engine.ts, which does all its
 * actual reads/writes through `withTenant` — RLS enforces isolation for
 * every row that's touched, exactly like every other module.
 */

const QUEUE_NAME = 'bot-flow-poll';
const JOB_NAME = 'scan';
const POLL_INTERVAL_MS = 10_000;
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // only scan conversations active in the last 7 days

let queue: Queue | null = null;
let worker: Worker | null = null;

async function scan(): Promise<void> {
  const assignments = await systemPrisma.botFlowAssignment.findMany();

  for (const assignment of assignments) {
    const { organizationId, channel } = assignment;
    const connection = await systemPrisma.channelConnection.findUnique({
      where: { organizationId_channel: { organizationId, channel } },
    });
    if (!connection || connection.status !== 'CONNECTED') continue;

    let conversations;
    try {
      conversations = await systemPrisma.conversation.findMany({
        where: { organizationId, channel, lastInboundAt: { gte: new Date(Date.now() - RECENT_WINDOW_MS) } },
        include: {
          messages: { where: { direction: 'INBOUND' }, orderBy: { createdAt: 'desc' }, take: 1 },
          botFlowSession: true,
        },
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Bot Flow poller: failed to list conversations for org', organizationId, err instanceof Error ? err.message : err);
      continue;
    }

    for (const conversation of conversations) {
      const latestInbound = conversation.messages[0];
      if (!latestInbound) continue;
      const session = conversation.botFlowSession;
      if (session && session.status !== 'ACTIVE') continue;
      if (session?.lastProcessedMessageAt && session.lastProcessedMessageAt >= latestInbound.createdAt) continue;

      try {
        await advanceBotFlow(organizationId, conversation.id, latestInbound.body ?? '', latestInbound.createdAt);
      } catch (err) {
        // One conversation's failure must never stop the rest of the scan.
        // eslint-disable-next-line no-console
        console.error('Bot Flow poller: failed to advance conversation', conversation.id, err instanceof Error ? err.message : err);
      }
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
