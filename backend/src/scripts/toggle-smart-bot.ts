/**
 * TEMP ADMIN SCRIPT — Smart Bot (backend/src/modules/bot) has no Settings UI
 * yet; this is the only way to flip its per-organization feature flag for
 * testing. Delete once a real Settings toggle exists.
 *
 * Usage:
 *   npx tsx src/scripts/toggle-smart-bot.ts
 *     → no organization id given: lists every Organization (id + name) and
 *       whether Smart Bot is currently enabled for it, then exits.
 *
 *   npx tsx src/scripts/toggle-smart-bot.ts <organizationId> on
 *   npx tsx src/scripts/toggle-smart-bot.ts <organizationId> off
 *     → enables/disables Smart Bot for that org (upserts SmartBotSettings).
 *       Safe to re-run.
 *
 * Reminder: Smart Bot silently defers to Bot Flow if that org also has a
 * Bot Flow assigned to WhatsApp (see smart-bot.service.ts) — turning this on
 * for an org that already uses Bot Flow for WhatsApp will look like nothing
 * happened; that's the guard working as intended, not a bug.
 */
import { systemPrisma } from '../lib/prisma';

async function listOrganizations(): Promise<void> {
  const orgs = await systemPrisma.organization.findMany({
    select: { id: true, name: true, smartBotSettings: { select: { enabled: true } } },
    orderBy: { name: 'asc' },
  });

  if (orgs.length === 0) {
    console.log('\nNo organizations found.\n');
    return;
  }
  console.log('\nOrganizations:\n');
  for (const org of orgs) {
    console.log(`  ${org.id}  ${org.name}  — Smart Bot: ${org.smartBotSettings?.enabled ? 'ON' : 'off'}`);
  }
  console.log('\nRe-run with one of the ids above and "on" or "off" to change it.\n');
}

async function setEnabled(organizationId: string, enabled: boolean): Promise<void> {
  const org = await systemPrisma.organization.findUnique({ where: { id: organizationId }, select: { id: true, name: true } });
  if (!org) {
    console.error(`No organization found with id ${organizationId}`);
    process.exitCode = 1;
    return;
  }

  await systemPrisma.smartBotSettings.upsert({
    where: { organizationId },
    create: { organizationId, enabled },
    update: { enabled },
  });

  console.log(`\n✓ Smart Bot ${enabled ? 'enabled' : 'disabled'} for ${org.name} (${org.id})\n`);
}

async function main(): Promise<void> {
  const [organizationId, mode] = process.argv.slice(2);
  if (!organizationId) {
    await listOrganizations();
    return;
  }
  if (mode !== 'on' && mode !== 'off') {
    console.error('Usage: npx tsx src/scripts/toggle-smart-bot.ts <organizationId> <on|off>');
    process.exitCode = 1;
    return;
  }
  await setEnabled(organizationId, mode === 'on');
}

main()
  .catch((err) => {
    console.error('FATAL:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await systemPrisma.$disconnect();
  });
