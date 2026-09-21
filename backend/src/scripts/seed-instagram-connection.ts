/**
 * TEMP ADMIN SCRIPT — manual Instagram connection fallback, for onboarding a
 * real client ahead of (or instead of) the automated Instagram Login OAuth
 * flow while its exchangeInstagramLongLivedToken /access_token 400 is
 * unresolved (see diagnoseInstagramTokenExchange in lib/meta.ts). Do not use
 * in front of real client data beyond that stopgap purpose. Delete or gate
 * behind proper auth before this becomes a permanent tool.
 *
 * Same pattern as seed-whatsapp-connection.ts: manually creates/updates an
 * Instagram ChannelConnection row exactly the way channels.service.ts's
 * connectInstagram() / saveInstagramLoginConnection() would — same fields,
 * same encryption, same credentials shape — so sendInstagramText/Image and
 * webhooks.service.ts's inbound routing work against it unmodified.
 *
 * Usage:
 *   npx tsx src/scripts/seed-instagram-connection.ts
 *     → no organization id given: lists every Organization (id + name) and exits.
 *
 *   npx tsx src/scripts/seed-instagram-connection.ts <organizationId>
 *     → reads INSTAGRAM_SEED_ACCESS_TOKEN (the long-lived "IGAG..." token,
 *       obtained manually via Graph API Explorer's "Generate token" under the
 *       Instagram app's "API setup with Instagram login" page) from the
 *       environment. Calls graph.instagram.com itself with that token to
 *       fetch and confirm the real Instagram-scoped user id + username
 *       (never trusts manually-typed values for these), then upserts a
 *       CONNECTED Instagram ChannelConnection for that org (safe to re-run).
 */
import { systemPrisma, withTenant } from '../lib/prisma';
import { encryptJson } from '../lib/encryption';
import { fetchInstagramLoginProfile } from '../lib/meta';
import type { InstagramCredentials } from '../modules/channels/channels.service';

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
  console.log('\nRe-run with one of the ids above as the first argument to seed an Instagram connection for it.\n');
}

async function seedConnection(organizationId: string): Promise<void> {
  const accessToken = process.env.INSTAGRAM_SEED_ACCESS_TOKEN;

  if (!accessToken) {
    console.error('Missing required env var: INSTAGRAM_SEED_ACCESS_TOKEN');
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

  // Never trust a manually-typed igUserId/username — fetch and confirm both
  // directly from Meta with the token itself, same call the automated OAuth
  // flow makes after exchanging its long-lived token.
  console.log('\nFetching Instagram profile for the given access token…');
  const { igUserId, username } = await fetchInstagramLoginProfile(accessToken);
  console.log(`  igUserId: ${igUserId}`);
  console.log(`  username: @${username}`);

  // Exact shape saveInstagramLoginConnection() encrypts and sendInstagramText/
  // Image() decrypt — see channels.service.ts / lib/meta.ts. Never logged below.
  const credentials: InstagramCredentials = { accessToken, igUserId };

  const row = await withTenant(organizationId, (tx) =>
    tx.channelConnection.upsert({
      where: { organizationId_channel: { organizationId, channel: 'INSTAGRAM' } },
      create: {
        organizationId,
        channel: 'INSTAGRAM',
        status: 'CONNECTED',
        displayName: `@${username}`,
        externalId: igUserId,
        secondaryExternalId: null,
        credentials: encryptJson(credentials),
        connectedAt: new Date(),
        lastError: null,
      },
      update: {
        status: 'CONNECTED',
        displayName: `@${username}`,
        externalId: igUserId,
        secondaryExternalId: null,
        credentials: encryptJson(credentials),
        connectedAt: new Date(),
        lastError: null,
      },
    }),
  );

  console.log('\n✓ Instagram ChannelConnection upserted');
  console.log(`  organization: ${org.name} (${org.id})`);
  console.log(`  channel: ${row.channel}`);
  console.log(`  status: ${row.status}`);
  console.log(`  externalId (Instagram-scoped user id): ${row.externalId}`);
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
