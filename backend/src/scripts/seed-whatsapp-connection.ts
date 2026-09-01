/**
 * TEMP ADMIN SCRIPT — for manually testing WhatsApp before Embedded Signup UI
 * exists. Do not use in front of real client data. Delete or gate behind
 * proper auth before this becomes a permanent tool.
 *
 * Manually creates/updates a WhatsApp ChannelConnection row exactly the way
 * channels.service.ts's connectWhatsApp() would — same fields, same
 * encryption, same credentials shape — so inbox.service.ts's sendMessage()
 * and webhooks.service.ts's inbound routing work against it unmodified.
 *
 * Usage:
 *   npx tsx src/scripts/seed-whatsapp-connection.ts
 *     → no organization id given: lists every Organization (id + name) and exits.
 *
 *   npx tsx src/scripts/seed-whatsapp-connection.ts <organizationId>
 *     → reads WHATSAPP_SEED_PHONE_NUMBER_ID, WHATSAPP_SEED_ACCESS_TOKEN, and
 *       WHATSAPP_SEED_WABA_ID from the environment and upserts a CONNECTED
 *       WhatsApp ChannelConnection for that org (safe to re-run).
 */
import { systemPrisma, withTenant } from '../lib/prisma';
import { encryptJson } from '../lib/encryption';
import type { WhatsAppCredentials } from '../modules/channels/channels.service';

async function listOrganizations(): Promise<void> {
  const orgs = await systemPrisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  if (orgs.length === 0) {
    console.log('\nNo organizations found.\n');
    return;
  }
  console.log('\nOrganizations:\n');
  for (const org of orgs) {
    console.log(`  ${org.id}  ${org.name}`);
  }
  console.log('\nRe-run with one of the ids above as the first argument to seed a WhatsApp connection for it.\n');
}

async function seedConnection(organizationId: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_SEED_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_SEED_ACCESS_TOKEN;
  const wabaId = process.env.WHATSAPP_SEED_WABA_ID;

  if (!phoneNumberId || !accessToken || !wabaId) {
    console.error(
      'Missing one or more required env vars: WHATSAPP_SEED_PHONE_NUMBER_ID, WHATSAPP_SEED_ACCESS_TOKEN, WHATSAPP_SEED_WABA_ID',
    );
    process.exitCode = 1;
    return;
  }

  const org = await systemPrisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });
  if (!org) {
    console.error(`No organization found with id ${organizationId}`);
    process.exitCode = 1;
    return;
  }

  // Exact shape connectWhatsApp() encrypts and sendMessage() decrypts — see
  // channels.service.ts / inbox.service.ts. Never logged below.
  const credentials: WhatsAppCredentials = { accessToken, phoneNumberId, wabaId };

  const row = await withTenant(organizationId, (tx) =>
    tx.channelConnection.upsert({
      where: { organizationId_channel: { organizationId, channel: 'WHATSAPP' } },
      create: {
        organizationId,
        channel: 'WHATSAPP',
        status: 'CONNECTED',
        displayName: `WhatsApp (seeded — ${phoneNumberId})`,
        externalId: wabaId,
        credentials: encryptJson(credentials),
        connectedAt: new Date(),
        lastError: null,
      },
      update: {
        status: 'CONNECTED',
        displayName: `WhatsApp (seeded — ${phoneNumberId})`,
        externalId: wabaId,
        credentials: encryptJson(credentials),
        connectedAt: new Date(),
        lastError: null,
      },
    }),
  );

  console.log('\n✓ WhatsApp ChannelConnection upserted');
  console.log(`  organization: ${org.name} (${org.id})`);
  console.log(`  channel: ${row.channel}`);
  console.log(`  status: ${row.status}`);
  console.log(`  externalId (WABA id): ${row.externalId}`);
  console.log(`  displayName: ${row.displayName}`);
  console.log('  credentials: [encrypted — not shown]\n');
}

async function main(): Promise<void> {
  const organizationId = process.argv[2];
  if (!organizationId) {
    await listOrganizations();
    return;
  }
  await seedConnection(organizationId);
}

main()
  .catch((err) => {
    console.error('FATAL:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await systemPrisma.$disconnect();
  });
