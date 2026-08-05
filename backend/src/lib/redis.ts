import { Redis } from 'ioredis';
import { env } from '../env';

/**
 * Shared Redis connection for BullMQ (Bot Flow's inbound-message poller, the
 * follow-up nudge scheduler). Optional at the env level, same as Supabase/
 * Gemini/Meta — every automation endpoint checks `isRedisConfigured()` and
 * 503s with a clear message instead of the server crashing at boot when
 * REDIS_URL is unset.
 */

let connection: Redis | null = null;

export function isRedisConfigured(): boolean {
  return !!env.REDIS_URL;
}

/** Lazily creates the shared ioredis connection. BullMQ requires this exact option. */
export function getRedisConnection(): Redis {
  if (connection) return connection;
  if (!env.REDIS_URL) {
    throw new Error('REDIS_URL is not configured — automation features are disabled');
  }
  connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
}

export async function disconnectRedis(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
