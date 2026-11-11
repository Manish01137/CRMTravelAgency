import { Queue, Worker, type Job } from 'bullmq';
import { getRedisConnection } from '../lib/redis';
import { runDueScheduledMessages } from '../modules/inbox/scheduled.service';

/**
 * Sends Inbox messages scheduled for later. A BullMQ repeatable job every
 * 30s; each pass is one small indexed query (status + send_at) when nothing
 * is due, so it adds next to nothing to database traffic.
 */

const QUEUE_NAME = 'scheduled-messages';
const JOB_NAME = 'send-due';
const INTERVAL_MS = 30_000;

let queue: Queue | null = null;
let worker: Worker | null = null;

export async function startScheduledMessages(): Promise<void> {
  const connection = getRedisConnection();
  queue = new Queue(QUEUE_NAME, { connection });
  await queue.upsertJobScheduler(JOB_NAME, { every: INTERVAL_MS }, { opts: { removeOnComplete: true, removeOnFail: 20 } });
  worker = new Worker(QUEUE_NAME, async (_job: Job) => runDueScheduledMessages(), { connection, concurrency: 1 });
  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error('Scheduled messages job failed:', job?.id, err.message);
  });
}

export async function stopScheduledMessages(): Promise<void> {
  await worker?.close();
  await queue?.close();
}
