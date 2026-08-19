import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { systemPrisma } from '../../lib/prisma';
import { hashPassword, verifyPassword } from '../../lib/password';
import { createOrgAndUser } from '../auth/auth.service';
import { logPlatformAction } from '../../lib/platformAudit';
import { BadRequest, NotFound, Unauthorized } from '../../lib/errors';
import type {
  AddOrganizationNoteInput,
  AuditLogQuery,
  CreateOrganizationInput,
  GrowthQuery,
  ListOrganizationsQuery,
  ListUsersQuery,
  PlatformAdminLoginInput,
  SearchQuery,
  UpdateOrganizationStatusInput,
  UpdateUserStatusInput,
} from './platform-admin.schemas';

/** Actor identity attached to every mutating call, for the audit log. */
export interface PlatformActor {
  adminId: string;
  adminEmail: string;
}

/**
 * Every function here runs on systemPrisma — the privileged, table-owner
 * connection that's exempt from Row Level Security. That's deliberate and
 * safe ONLY because this whole module sits behind requirePlatformAdmin, a
 * separate auth surface from the tenant JWT/session (see
 * middleware/platformAdmin.ts). This is the one legitimate place in the app
 * that's supposed to see across every organization at once.
 */

export interface PlatformAdminSession {
  id: string;
  email: string;
  name: string;
}

function toPublicAdmin(admin: { id: string; email: string; name: string }): PlatformAdminSession {
  return { id: admin.id, email: admin.email, name: admin.name };
}

export async function login(input: PlatformAdminLoginInput): Promise<PlatformAdminSession> {
  const admin = await systemPrisma.platformAdmin.findUnique({ where: { email: input.email } });
  if (!admin || !(await verifyPassword(input.password, admin.passwordHash))) {
    throw Unauthorized('Invalid email or password');
  }
  await systemPrisma.platformAdmin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  return toPublicAdmin(admin);
}

export async function getSession(adminId: string): Promise<PlatformAdminSession> {
  const admin = await systemPrisma.platformAdmin.findUnique({ where: { id: adminId } });
  if (!admin) throw Unauthorized('Your session is no longer valid');
  return toPublicAdmin(admin);
}

export async function getPlatformStats() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalOrganizations,
    suspendedOrganizations,
    organizationsNewLast7d,
    organizationsNewLast30d,
    totalUsers,
    disabledUsers,
    totalLeads,
    totalBookings,
    bookingValue,
    recentOrganizations,
  ] = await Promise.all([
    systemPrisma.organization.count(),
    systemPrisma.organization.count({ where: { status: 'SUSPENDED' } }),
    systemPrisma.organization.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    systemPrisma.organization.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    systemPrisma.user.count(),
    systemPrisma.user.count({ where: { status: 'DISABLED' } }),
    systemPrisma.lead.count(),
    systemPrisma.booking.count(),
    systemPrisma.booking.aggregate({ _sum: { totalAmount: true }, where: { status: { notIn: ['CANCELLED'] } } }),
    systemPrisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { id: true, name: true, slug: true, status: true, createdAt: true, _count: { select: { users: true } } },
    }),
  ]);

  return {
    organizations: { total: totalOrganizations, suspended: suspendedOrganizations, newLast7d: organizationsNewLast7d, newLast30d: organizationsNewLast30d },
    users: { total: totalUsers, disabled: disabledUsers },
    leads: { total: totalLeads },
    bookings: { total: totalBookings, totalValue: bookingValue._sum.totalAmount ?? 0 },
    recentOrganizations,
  };
}

export async function listOrganizations(query: ListOrganizationsQuery) {
  const where: Prisma.OrganizationWhereInput = {};
  if (query.status) where.status = query.status;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { slug: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    systemPrisma.organization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        suspendedAt: true,
        suspendedReason: true,
        createdAt: true,
        _count: { select: { users: true, leads: true, bookings: true } },
      },
    }),
    systemPrisma.organization.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

export async function getOrganization(id: string) {
  const organization = await systemPrisma.organization.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, email: true, name: true, role: true, status: true, lastLoginAt: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { leads: true, bookings: true } },
    },
  });
  if (!organization) throw NotFound('Organization not found');

  const bookingValue = await systemPrisma.booking.aggregate({
    where: { organizationId: id, status: { notIn: ['CANCELLED'] } },
    _sum: { totalAmount: true },
  });

  return { ...organization, totalBookingValue: bookingValue._sum.totalAmount ?? 0 };
}

export async function updateOrganizationStatus(id: string, input: UpdateOrganizationStatusInput, actor: PlatformActor) {
  const organization = await systemPrisma.organization.findUnique({ where: { id } });
  if (!organization) throw NotFound('Organization not found');

  const updated = await systemPrisma.organization.update({
    where: { id },
    data: {
      status: input.status,
      suspendedAt: input.status === 'SUSPENDED' ? new Date() : null,
      suspendedReason: input.status === 'SUSPENDED' ? (input.reason ?? null) : null,
    },
  });

  await logPlatformAction({
    ...actor,
    action: input.status === 'SUSPENDED' ? 'ORGANIZATION_SUSPENDED' : 'ORGANIZATION_REACTIVATED',
    targetType: 'ORGANIZATION',
    targetId: id,
    targetLabel: organization.name,
    metadata: { previousStatus: organization.status, newStatus: input.status, reason: input.reason },
  });

  return updated;
}

export async function listUsers(query: ListUsersQuery) {
  const where: Prisma.UserWhereInput = {};
  if (query.role) where.role = query.role;
  if (query.status) where.status = query.status;
  if (query.organizationId) where.organizationId = query.organizationId;
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    systemPrisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        organization: { select: { id: true, name: true, slug: true, status: true } },
      },
    }),
    systemPrisma.user.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

export async function updateUserStatus(id: string, input: UpdateUserStatusInput, actor: PlatformActor) {
  const user = await systemPrisma.user.findUnique({ where: { id } });
  if (!user) throw NotFound('User not found');

  const updated = await systemPrisma.user.update({ where: { id }, data: { status: input.status } });

  await logPlatformAction({
    ...actor,
    action: input.status === 'DISABLED' ? 'USER_DISABLED' : 'USER_ENABLED',
    targetType: 'USER',
    targetId: id,
    targetLabel: user.email,
    metadata: { previousStatus: user.status, newStatus: input.status },
  });

  return updated;
}

/** Creates a new organization + its first ADMIN user, for white-glove onboarding
 *  from the panel — skips self-signup/OTP entirely. Reuses the exact same
 *  slug-uniqueness logic as the real signup flow (auth.service.createOrgAndUser). */
export async function createOrganization(input: CreateOrganizationInput, actor: PlatformActor) {
  const existing = await systemPrisma.user.findUnique({ where: { email: input.adminEmail } });
  if (existing) throw BadRequest('A user with this email already exists');

  const generatedPassword = input.adminPassword ?? crypto.randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(generatedPassword);

  const { organization, user } = await createOrgAndUser({
    organizationName: input.organizationName,
    name: input.adminName,
    email: input.adminEmail,
    passwordHash,
  });

  await logPlatformAction({
    ...actor,
    action: 'ORGANIZATION_CREATED',
    targetType: 'ORGANIZATION',
    targetId: organization.id,
    targetLabel: organization.name,
    metadata: { adminEmail: user.email },
  });

  // The plaintext password is returned exactly once — it's never stored or
  // retrievable again, same guarantee as any other account creation.
  return { organization, admin: { email: user.email, name: user.name }, generatedPassword };
}

export async function listOrganizationNotes(organizationId: string) {
  return systemPrisma.organizationNote.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addOrganizationNote(organizationId: string, input: AddOrganizationNoteInput, actor: PlatformActor) {
  const organization = await systemPrisma.organization.findUnique({ where: { id: organizationId } });
  if (!organization) throw NotFound('Organization not found');

  const note = await systemPrisma.organizationNote.create({
    data: { organizationId, adminId: actor.adminId, adminEmail: actor.adminEmail, body: input.body },
  });

  await logPlatformAction({
    ...actor,
    action: 'NOTE_ADDED',
    targetType: 'ORGANIZATION',
    targetId: organizationId,
    targetLabel: organization.name,
  });

  return note;
}

export async function deleteOrganizationNote(organizationId: string, noteId: string) {
  const result = await systemPrisma.organizationNote.deleteMany({ where: { id: noteId, organizationId } });
  if (result.count === 0) throw NotFound('Note not found');
}

/** Channels with a stored FAILED status (or any other than CONNECTED) across
 *  every organization — the "what's broken right now" view. NOT_CONNECTED is
 *  synthesized (no row ever exists for a channel nobody has tried to connect),
 *  so this only surfaces real, attempted connections that need attention. */
export async function getChannelHealth() {
  const [byChannelStatus, failedConnections] = await Promise.all([
    systemPrisma.channelConnection.groupBy({ by: ['channel', 'status'], _count: { _all: true } }),
    systemPrisma.channelConnection.findMany({
      where: { status: 'FAILED' },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        channel: true,
        status: true,
        displayName: true,
        lastError: true,
        connectedAt: true,
        updatedAt: true,
        organization: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  const summary: Record<string, Record<string, number>> = {};
  for (const row of byChannelStatus) {
    (summary[row.channel] ??= {})[row.status] = row._count._all;
  }

  return { summary, failedConnections };
}

/** Weekly organization signup counts for the last N weeks — bucketed in JS
 *  rather than raw SQL date_trunc, since organization volume is small enough
 *  that this stays simple and portable. */
export async function getGrowth(query: GrowthQuery) {
  const weeks = query.weeks;
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - weeks * 7);

  const organizations = await systemPrisma.organization.findMany({
    where: { createdAt: { gte: start } },
    select: { createdAt: true },
  });

  const buckets: { weekStart: string; count: number }[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const bucketStart = new Date(now);
    bucketStart.setHours(0, 0, 0, 0);
    bucketStart.setDate(bucketStart.getDate() - i * 7);
    const bucketEnd = new Date(bucketStart);
    bucketEnd.setDate(bucketEnd.getDate() + 7);
    const count = organizations.filter((o) => o.createdAt >= bucketStart && o.createdAt < bucketEnd).length;
    buckets.push({ weekStart: bucketStart.toISOString(), count });
  }

  return { weeks: buckets };
}

/** Cross-entity search — organizations, users, leads, and bookings, capped per
 *  category. Leads/bookings surface their owning organization so a result is
 *  always actionable (there's no per-lead owner view, so it links to the org). */
export async function search(query: SearchQuery) {
  const q = query.q;
  const [organizations, users, leads, bookings] = await Promise.all([
    systemPrisma.organization.findMany({
      where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] },
      take: 5,
      select: { id: true, name: true, slug: true, status: true },
    }),
    systemPrisma.user.findMany({
      where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] },
      take: 5,
      select: { id: true, name: true, email: true, organization: { select: { id: true, name: true } } },
    }),
    systemPrisma.lead.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, name: true, email: true, phone: true, organization: { select: { id: true, name: true } } },
    }),
    systemPrisma.booking.findMany({
      where: {
        OR: [
          { customerName: { contains: q, mode: 'insensitive' } },
          { customerPhone: { contains: q, mode: 'insensitive' } },
          { customerEmail: { contains: q, mode: 'insensitive' } },
        ],
      },
      take: 5,
      select: { id: true, bookingNumber: true, customerName: true, customerPhone: true, organization: { select: { id: true, name: true } } },
    }),
  ]);

  return { organizations, users, leads, bookings };
}

export async function listAuditLog(query: AuditLogQuery) {
  const where: Prisma.PlatformAuditLogWhereInput = {};
  if (query.targetType) where.targetType = query.targetType;
  if (query.targetId) where.targetId = query.targetId;

  const [items, total] = await Promise.all([
    systemPrisma.platformAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    systemPrisma.platformAuditLog.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) };
}

/** One-time bootstrap for the very first owner account — not exposed over HTTP.
 *  Used by the `owner:create` CLI script only. */
export async function createPlatformAdmin(email: string, name: string, password: string): Promise<PlatformAdminSession> {
  const existing = await systemPrisma.platformAdmin.findUnique({ where: { email } });
  if (existing) throw BadRequest('An owner account with this email already exists');
  const admin = await systemPrisma.platformAdmin.create({
    data: { email, name, passwordHash: await hashPassword(password) },
  });
  return toPublicAdmin(admin);
}
