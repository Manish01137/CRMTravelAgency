/**
 * Tenant isolation test (PROJECT_SPEC.md §4.5 — "the single most important thing").
 *
 *   npm run test:isolation
 *
 * Proves, using the RESTRICTED runtime connection (crm_app, RLS enforced), that
 * Organization A can never see, forge, update, or delete Organization B's data —
 * including via a raw query with no organization filter. Fails closed when no org
 * context is set.
 *
 * Requires APP_DATABASE_URL to point at the crm_app role (run `npm run db:roles`).
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import { systemPrisma, tenantPrisma, withTenant, disconnectPrisma } from '../src/lib/prisma';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    // eslint-disable-next-line no-console
    console.error(`  ✗ ${name}`);
  }
}

async function main() {
  if (!process.env.APP_DATABASE_URL) {
    throw new Error(
      'APP_DATABASE_URL is not set. This test is only meaningful against the restricted\n' +
        'crm_app role. Set APP_DATABASE_URL in backend/.env and run `npm run db:roles` first.',
    );
  }
  if (process.env.APP_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error(
      'APP_DATABASE_URL equals DATABASE_URL (the owner connection). RLS would be bypassed.\n' +
        'Point APP_DATABASE_URL at the crm_app role and run `npm run db:roles` first.',
    );
  }

  const suffix = crypto.randomBytes(4).toString('hex');

  // --- Setup: two orgs, each with one lead, via the privileged connection. ---
  const orgA = await systemPrisma.organization.create({
    data: { name: `ISO-A-${suffix}`, slug: `iso-a-${suffix}` },
  });
  const orgB = await systemPrisma.organization.create({
    data: { name: `ISO-B-${suffix}`, slug: `iso-b-${suffix}` },
  });
  const leadA = await systemPrisma.lead.create({
    data: { organizationId: orgA.id, name: 'Alice (Org A)' },
  });
  const leadB = await systemPrisma.lead.create({
    data: { organizationId: orgB.id, name: 'Bob (Org B)' },
  });

  try {
    // eslint-disable-next-line no-console
    console.log('\nTenant isolation checks (running as restricted crm_app role):\n');

    // 1. Scoped read returns only your own rows.
    await withTenant(orgA.id, async (tx) => {
      const leads = await tx.lead.findMany();
      check('A: findMany returns only Org A leads', leads.every((l) => l.organizationId === orgA.id));
      check('A: sees its own lead', leads.some((l) => l.id === leadA.id));
      check('A: does NOT see Org B lead', !leads.some((l) => l.id === leadB.id));

      const orgs = await tx.organization.findMany();
      check('A: can only see its own organization row', orgs.length === 1 && orgs[0].id === orgA.id);
    });

    // 2. Raw query with NO organization filter still cannot cross tenants.
    await withTenant(orgA.id, async (tx) => {
      const rows = await tx.$queryRawUnsafe<Array<{ organization_id: string }>>(
        'SELECT id, organization_id FROM leads',
      );
      check(
        'A: raw "SELECT * FROM leads" (no WHERE) returns only Org A rows',
        rows.length > 0 && rows.every((r) => r.organization_id === orgA.id),
      );
    });

    // 3. Cannot read Org B's row by id.
    await withTenant(orgA.id, async (tx) => {
      const stolen = await tx.lead.findUnique({ where: { id: leadB.id } });
      check('A: findUnique on Org B lead id returns null', stolen === null);
    });

    // 4. Cannot update Org B's row.
    await withTenant(orgA.id, async (tx) => {
      const res = await tx.lead.updateMany({ where: { id: leadB.id }, data: { name: 'HACKED' } });
      check('A: updateMany targeting Org B lead affects 0 rows', res.count === 0);
    });
    const afterUpdate = await systemPrisma.lead.findUnique({ where: { id: leadB.id } });
    check("A: Org B's lead name is unchanged", afterUpdate?.name === 'Bob (Org B)');

    // 5. Cannot delete Org B's row.
    await withTenant(orgA.id, async (tx) => {
      const res = await tx.lead.deleteMany({ where: { id: leadB.id } });
      check('A: deleteMany targeting Org B lead affects 0 rows', res.count === 0);
    });
    const afterDelete = await systemPrisma.lead.findUnique({ where: { id: leadB.id } });
    check("A: Org B's lead still exists", afterDelete !== null);

    // 6. Cannot forge a row into Org B (WITH CHECK).
    let forgeRejected = false;
    try {
      await withTenant(orgA.id, async (tx) => {
        await tx.lead.create({ data: { organizationId: orgB.id, name: 'Forged into B' } });
      });
    } catch {
      forgeRejected = true;
    }
    check('A: inserting a lead with Org B id is rejected by RLS WITH CHECK', forgeRejected);

    // 7. Fail-closed: no org context set => zero rows visible.
    const noContext = await tenantPrisma.$transaction((tx) => tx.lead.findMany());
    check('No org context set => zero leads visible (fail-closed)', noContext.length === 0);

    // eslint-disable-next-line no-console
    console.log(`\nResult: ${passed} passed, ${failed} failed.\n`);
  } finally {
    // --- Teardown (cascades to leads). ---
    await systemPrisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  }

  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('\nIsolation test errored:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => disconnectPrisma());
