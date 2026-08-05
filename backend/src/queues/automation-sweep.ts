import { Queue, Worker, type Job } from 'bullmq';
import { getRedisConnection } from '../lib/redis';
import { systemPrisma } from '../lib/prisma';
import { sweepOrganization } from '../modules/automation/automation.engine';

const QUEUE_NAME = 'automation-sweep';
const JOB_NAME = 'sweep';
const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let queue: Queue | null = null;
let worker: Worker | null = null;

async function sweepAll(): Promise<void> {
  const orgIds = await systemPrisma.automationSettings.findMany({ where: { enabled: true }, select: { organizationId: true } });
  for (const { organizationId } of orgIds) {
    try {
      await sweepOrganization(organizationId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Automation sweep: failed for org', organizationId, err instanceof Error ? err.message : err);
    }
  }
}

export async function startAutomationSweep(): Promise<void> {
  const connection = getRedisConnection();
  queue = new Queue(QUEUE_NAME, { connection });
  await queue.upsertJobScheduler(JOB_NAME, { every: SWEEP_INTERVAL_MS }, { opts: { removeOnComplete: true, removeOnFail: 20 } });

  worker = new Worker(QUEUE_NAME, async (_job: Job) => sweepAll(), { connection, concurrency: 1 });
  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error('Automation sweep job failed:', job?.id, err.message);
  });
}

export async function stopAutomationSweep(): Promise<void> {
  await worker?.close();
  await queue?.close();
}

/** Test/manual-trigger hook — runs one sweep pass immediately, outside the schedule. */
export const runAutomationSweepOnce = sweepAll;
