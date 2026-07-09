import { PrismaClient, Prisma } from '@prisma/client';
import { env } from '../env';

const logLevels: Prisma.LogLevel[] =
  env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'];

/**
 * systemPrisma — privileged/owner connection (DATABASE_URL).
 *
 * The table owner is exempt from RLS, so this client CAN read across tenants.
 * Its use is deliberately confined to the tiny auth surface (src/modules/auth):
 *   - login  → look a user up by email before any org is known
 *   - signup → create a brand-new organization + its first admin
 *   - accept-invite → resolve an invitation token to its organization
 * Do NOT use it for ordinary tenant requests — use `withTenant` instead.
 */
export const systemPrisma = new PrismaClient({
  datasources: { db: { url: env.DATABASE_URL } },
  log: logLevels,
});

if (!env.APP_DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.warn(
    '⚠  APP_DATABASE_URL is not set — tenant queries will use the privileged\n' +
      '   DATABASE_URL connection, so database-level RLS is NOT enforced\n' +
      '   (application-level organization scoping still applies). For the full\n' +
      '   safety net, set APP_DATABASE_URL and run `npm run db:roles`.',
  );
}

/**
 * tenantPrisma — restricted runtime connection (APP_DATABASE_URL, role `crm_app`).
 *
 * This role is not the table owner, so RLS is enforced on every query. Access it
 * only through `withTenant`, which pins a transaction and sets app.current_org_id.
 */
export const tenantPrisma = new PrismaClient({
  datasources: { db: { url: env.APP_DATABASE_URL ?? env.DATABASE_URL } },
  log: logLevels,
});

export type TenantTx = Prisma.TransactionClient;

/**
 * Runs `fn` inside a transaction whose connection has `app.current_org_id` set to
 * `organizationId`. Every query on the provided `tx` is therefore filtered by the
 * RLS policies to that one organization.
 *
 * Fail-closed: an empty/invalid id makes the RLS comparison NULL, so zero rows are
 * visible and zero rows are writable — a forgotten filter leaks nothing.
 */
export async function withTenant<T>(
  organizationId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  return tenantPrisma.$transaction(async (tx) => {
    // is_local = true → the setting lasts only for this transaction.
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${organizationId}, true)`;
    return fn(tx);
  });
}

export async function disconnectPrisma(): Promise<void> {
  await Promise.allSettled([systemPrisma.$disconnect(), tenantPrisma.$disconnect()]);
}
