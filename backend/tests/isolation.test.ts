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

    // 5b. Phase 2 tables follow the same policy — bookings as the canary.
    const bookA = await systemPrisma.booking.create({
      data: { organizationId: orgA.id, bookingNumber: 999901, customerName: 'Book A', destination: 'X' },
    });
    const bookB = await systemPrisma.booking.create({
      data: { organizationId: orgB.id, bookingNumber: 999901, customerName: 'Book B', destination: 'Y' },
    });
    await withTenant(orgA.id, async (tx) => {
      const books = await tx.booking.findMany();
      check(
        'A: bookings (Phase 2) — sees only own rows',
        books.some((b) => b.id === bookA.id) && books.every((b) => b.organizationId === orgA.id),
      );
      check('A: bookings — Org B booking invisible by id', (await tx.booking.findUnique({ where: { id: bookB.id } })) === null);
    });

    // 5c. Phase 3 (Communication) tables — same policy, one canary row per org each.
    const connA = await systemPrisma.channelConnection.create({
      data: { organizationId: orgA.id, channel: 'WHATSAPP', status: 'CONNECTED', displayName: 'A number' },
    });
    const connB = await systemPrisma.channelConnection.create({
      data: { organizationId: orgB.id, channel: 'WHATSAPP', status: 'CONNECTED', displayName: 'B number' },
    });
    await withTenant(orgA.id, async (tx) => {
      const conns = await tx.channelConnection.findMany();
      check(
        'A: channel_connections — sees only own rows',
        conns.some((c) => c.id === connA.id) && conns.every((c) => c.organizationId === orgA.id),
      );
      check('A: channel_connections — Org B row invisible by id', (await tx.channelConnection.findUnique({ where: { id: connB.id } })) === null);
    });

    const convA = await systemPrisma.conversation.create({
      data: { organizationId: orgA.id, channel: 'WHATSAPP', externalContactId: `wa-a-${suffix}`, contactName: 'A contact' },
    });
    const convB = await systemPrisma.conversation.create({
      data: { organizationId: orgB.id, channel: 'WHATSAPP', externalContactId: `wa-b-${suffix}`, contactName: 'B contact' },
    });
    await withTenant(orgA.id, async (tx) => {
      const convs = await tx.conversation.findMany();
      check(
        'A: conversations — sees only own rows',
        convs.some((c) => c.id === convA.id) && convs.every((c) => c.organizationId === orgA.id),
      );
      check('A: conversations — Org B row invisible by id', (await tx.conversation.findUnique({ where: { id: convB.id } })) === null);
    });

    const msgA = await systemPrisma.message.create({
      data: { organizationId: orgA.id, conversationId: convA.id, direction: 'INBOUND', body: 'Hi from A contact' },
    });
    const msgB = await systemPrisma.message.create({
      data: { organizationId: orgB.id, conversationId: convB.id, direction: 'INBOUND', body: 'Hi from B contact' },
    });
    await withTenant(orgA.id, async (tx) => {
      const msgs = await tx.message.findMany();
      check(
        'A: messages — sees only own rows',
        msgs.some((m) => m.id === msgA.id) && msgs.every((m) => m.organizationId === orgA.id),
      );
      check('A: messages — Org B row invisible by id', (await tx.message.findUnique({ where: { id: msgB.id } })) === null);
    });

    const tplA = await systemPrisma.messageTemplate.create({
      data: { organizationId: orgA.id, name: `tpl_a_${suffix}`, bodyText: 'Hello {{1}}' },
    });
    const tplB = await systemPrisma.messageTemplate.create({
      data: { organizationId: orgB.id, name: `tpl_b_${suffix}`, bodyText: 'Hello {{1}}' },
    });
    await withTenant(orgA.id, async (tx) => {
      const tpls = await tx.messageTemplate.findMany();
      check(
        'A: message_templates — sees only own rows',
        tpls.some((t) => t.id === tplA.id) && tpls.every((t) => t.organizationId === orgA.id),
      );
      check('A: message_templates — Org B row invisible by id', (await tx.messageTemplate.findUnique({ where: { id: tplB.id } })) === null);
    });

    const commA = await systemPrisma.communicationLog.create({
      data: { organizationId: orgA.id, leadId: leadA.id, channel: 'EMAIL', toAddress: 'a@example.com', body: 'Hi A' },
    });
    const commB = await systemPrisma.communicationLog.create({
      data: { organizationId: orgB.id, leadId: leadB.id, channel: 'EMAIL', toAddress: 'b@example.com', body: 'Hi B' },
    });
    await withTenant(orgA.id, async (tx) => {
      const logs = await tx.communicationLog.findMany();
      check(
        'A: communication_logs — sees only own rows',
        logs.some((l) => l.id === commA.id) && logs.every((l) => l.organizationId === orgA.id),
      );
      check('A: communication_logs — Org B row invisible by id', (await tx.communicationLog.findUnique({ where: { id: commB.id } })) === null);
    });

    // Call Log has no new table — it's a read view over LeadActivity(type=CALL).
    const callA = await systemPrisma.leadActivity.create({
      data: { organizationId: orgA.id, leadId: leadA.id, type: 'CALL', outcome: 'Connected', message: 'Call re: A' },
    });
    const callB = await systemPrisma.leadActivity.create({
      data: { organizationId: orgB.id, leadId: leadB.id, type: 'CALL', outcome: 'Connected', message: 'Call re: B' },
    });
    await withTenant(orgA.id, async (tx) => {
      const calls = await tx.leadActivity.findMany({ where: { type: 'CALL' } });
      check(
        'A: call log (lead_activities type=CALL) — sees only own rows',
        calls.some((c) => c.id === callA.id) && calls.every((c) => c.organizationId === orgA.id),
      );
      check('A: call log — Org B call invisible by id', (await tx.leadActivity.findUnique({ where: { id: callB.id } })) === null);
    });

    // 6. Cannot forge a row into Org B (WITH CHECK) — Phase 1 canary (leads) + one
    // Phase 3 canary (conversations, since it carries real customer message data).
    let forgeRejected = false;
    try {
      await withTenant(orgA.id, async (tx) => {
        await tx.lead.create({ data: { organizationId: orgB.id, name: 'Forged into B' } });
      });
    } catch {
      forgeRejected = true;
    }
    check('A: inserting a lead with Org B id is rejected by RLS WITH CHECK', forgeRejected);

    let conversationForgeRejected = false;
    try {
      await withTenant(orgA.id, async (tx) => {
        await tx.conversation.create({
          data: { organizationId: orgB.id, channel: 'WHATSAPP', externalContactId: `wa-forge-${suffix}` },
        });
      });
    } catch {
      conversationForgeRejected = true;
    }
    check('A: inserting a conversation with Org B id is rejected by RLS WITH CHECK', conversationForgeRejected);

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
