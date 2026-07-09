import { createApp } from './app';
import { env } from './env';
import { disconnectPrisma } from './lib/prisma';

const app = createApp();

const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`✓ API listening on http://localhost:${env.PORT}  (env: ${env.NODE_ENV})`);
});

function shutdown(signal: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n${signal} received — shutting down gracefully...`);
  server.close(() => {
    void disconnectPrisma().finally(() => process.exit(0));
  });
  // Force-exit if graceful shutdown hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}

(['SIGINT', 'SIGTERM'] as const).forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});
