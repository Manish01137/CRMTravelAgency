/**
 * Seed script — creates two demo organizations so you can log in immediately and
 * exercise cross-tenant isolation by hand. Idempotent (safe to re-run).
 *
 *   npm run prisma:seed
 *
 * Runs on the privileged DATABASE_URL connection (owner, exempt from RLS).
 */
import 'dotenv/config';
import { PrismaClient, type LeadSource, type LeadStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'Password123!';

interface SeedLead {
  name: string;
  email?: string;
  phone?: string;
  source: LeadSource;
  status: LeadStatus;
  destination?: string;
  budgetAmount?: number;
  assignToAgent?: boolean;
}

interface SeedOrg {
  slug: string;
  name: string;
  primary: string;
  admin: { name: string; email: string };
  agent: { name: string; email: string };
  leads: SeedLead[];
}

const ORGS: SeedOrg[] = [
  {
    slug: 'wanderlust-travel',
    name: 'Wanderlust Travel Co.',
    primary: '#4F46E5',
    admin: { name: 'Aisha Khan', email: 'admin@wanderlust.test' },
    agent: { name: 'Sam Rivera', email: 'sam@wanderlust.test' },
    leads: [
      { name: 'Priya Menon', email: 'priya@example.com', phone: '+91 98765 43210', source: 'WHATSAPP', status: 'NEW', destination: 'Bali, Indonesia', budgetAmount: 2500 },
      { name: 'Tom Becker', email: 'tom@example.com', source: 'INSTAGRAM', status: 'CONTACTED', destination: 'Swiss Alps', budgetAmount: 4200, assignToAgent: true },
      { name: 'Lucia Ferrari', phone: '+39 340 1122334', source: 'WEBSITE', status: 'QUALIFIED', destination: 'Kyoto, Japan', budgetAmount: 6000, assignToAgent: true },
      { name: 'Marcus Lee', email: 'marcus@example.com', source: 'REFERRAL', status: 'PROPOSAL_SENT', destination: 'Patagonia', budgetAmount: 7800 },
      { name: 'Nadia Hassan', email: 'nadia@example.com', source: 'FACEBOOK', status: 'WON', destination: 'Maldives', budgetAmount: 5300, assignToAgent: true },
    ],
  },
  {
    slug: 'globe-hoppers',
    name: 'Globe Hoppers',
    primary: '#0D9488',
    admin: { name: 'Diego Alvarez', email: 'admin@globehoppers.test' },
    agent: { name: 'Mei Lin', email: 'mei@globehoppers.test' },
    leads: [
      { name: 'Olivia Brown', email: 'olivia@example.com', source: 'WEBSITE', status: 'NEW', destination: 'Iceland Ring Road', budgetAmount: 3900 },
      { name: 'Raj Patel', phone: '+1 415 555 0134', source: 'PHONE', status: 'NEGOTIATION', destination: 'Serengeti Safari', budgetAmount: 9100, assignToAgent: true },
      { name: 'Sofia Rossi', email: 'sofia@example.com', source: 'INSTAGRAM', status: 'CONTACTED', destination: 'Santorini, Greece', budgetAmount: 4600, assignToAgent: true },
      { name: 'Chen Wei', email: 'chen@example.com', source: 'WALK_IN', status: 'LOST', destination: 'Machu Picchu', budgetAmount: 3200 },
    ],
  },
];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const org of ORGS) {
    const organization = await prisma.organization.upsert({
      where: { slug: org.slug },
      update: { name: org.name, brandPrimaryColor: org.primary },
      create: { slug: org.slug, name: org.name, brandPrimaryColor: org.primary },
    });

    await prisma.user.upsert({
      where: { email: org.admin.email },
      update: {},
      create: {
        organizationId: organization.id,
        email: org.admin.email,
        name: org.admin.name,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    const agent = await prisma.user.upsert({
      where: { email: org.agent.email },
      update: {},
      create: {
        organizationId: organization.id,
        email: org.agent.email,
        name: org.agent.name,
        passwordHash,
        role: 'AGENT',
        status: 'ACTIVE',
      },
    });

    const existingLeads = await prisma.lead.count({ where: { organizationId: organization.id } });
    if (existingLeads === 0) {
      for (const lead of org.leads) {
        await prisma.lead.create({
          data: {
            organizationId: organization.id,
            name: lead.name,
            email: lead.email ?? null,
            phone: lead.phone ?? null,
            source: lead.source,
            status: lead.status,
            destination: lead.destination ?? null,
            budgetAmount: lead.budgetAmount ?? null,
            budgetCurrency: 'USD',
            assignedToId: lead.assignToAgent ? agent.id : null,
          },
        });
      }
    }

    // eslint-disable-next-line no-console
    console.log(`✓ Seeded ${org.name} (${org.leads.length} leads)`);
  }

  // eslint-disable-next-line no-console
  console.log('\nDemo logins (password for all: %s):', DEMO_PASSWORD);
  for (const org of ORGS) {
    // eslint-disable-next-line no-console
    console.log(`  ${org.name.padEnd(22)} admin: ${org.admin.email}   agent: ${org.agent.email}`);
  }
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
