import { createApp } from './app';
import { env } from './env';
import { disconnectPrisma } from './lib/prisma';
import { isRedisConfigured, disconnectRedis } from './lib/redis';
import { startBotFlowPoller, stopBotFlowPoller } from './queues/bot-flow-poller';
import { startAutomationSweep, stopAutomationSweep } from './queues/automation-sweep';

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`✓ API listening on http://localhost:${env.PORT}  (env: ${env.NODE_ENV})`);
});

// Phase 4 automation workers — run in-process (see queues/). Gated on
// REDIS_URL like every other optional integration (Supabase/Gemini/Meta):
// absent, the server still starts fine, just without Bot Flow / follow-up
// automation running.
if (isRedisConfigured()) {
  Promise.all([startBotFlowPoller(), startAutomationSweep()])
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('✓ Automation workers started (Bot Flow poller, follow-up sweep)');
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('✗ Automation workers failed to start:', err instanceof Error ? err.message : err);
    });
} else {
  // eslint-disable-next-line no-console
  console.log('ℹ REDIS_URL not set — Bot Flow / follow-up automation workers are disabled');
}

function shutdown(signal: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(() => {
    Promise.allSettled([stopBotFlowPoller(), stopAutomationSweep(), disconnectRedis(), disconnectPrisma()]).finally(() => process.exit(0));
  });
  // Force-exit if graceful shutdown hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

(['SIGINT', 'SIGTERM'] as const).forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});
