import { Prisma } from '@prisma/client';
import { withTenant, type TenantTx } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/errors';
import type { CreateLeadInput, ListLeadsQuery, UpdateLeadInput } from './leads.schemas';

const assignedToSelect = {
  assignedTo: { select: { id: true, name: true, email: true } },
} satisfies Prisma.LeadInclude;

/** Ensures an assignee, if given, is a real member of THIS organization (RLS-scoped). */
async function assertAssigneeInOrg(tx: TenantTx, assignedToId: string | null | undefined) {
  if (!assignedToId) return;
  const member = await tx.user.findUnique({ where: { id: assignedToId } });
  if (!member) throw BadRequest('Assigned team member was not found in your organization');
}

export async function listLeads(organizationId: string, query: ListLeadsQuery) {
  return withTenant(organizationId, async (tx) => {
    const where: Prisma.LeadWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.source) where.source = query.source;
    if (query.assignedToId === 'unassigned') where.assignedToId = null;
    else if (query.assignedToId) where.assignedToId = query.assignedToId;

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { destination: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Sequential (not Promise.all) — an interactive transaction uses one connection.
    const items = await tx.lead.findMany({
      where,
      include: assignedToSelect,
      orderBy: { [query.sort]: query.order },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    const total = await tx.lead.count({ where });

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  });
}

export async function getLead(organizationId: string, id: string) {
  return withTenant(organizationId, async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id }, include: assignedToSelect });
    if (!lead) throw NotFound('Lead not found');
    return lead;
  });
}

export async function createLead(organizationId: string, input: CreateLeadInput) {
  return withTenant(organizationId, async (tx) => {
    await assertAssigneeInOrg(tx, input.assignedToId);
    return tx.lead.create({
      data: { ...input, organizationId },
      include: assignedToSelect,
    });
  });
}

export async function updateLead(organizationId: string, id: string, input: UpdateLeadInput) {
  return withTenant(organizationId, async (tx) => {
    const existing = await tx.lead.findUnique({ where: { id } });
    if (!existing) throw NotFound('Lead not found');
    await assertAssigneeInOrg(tx, input.assignedToId);
    return tx.lead.update({ where: { id }, data: input, include: assignedToSelect });
  });
}

export async function deleteLead(organizationId: string, id: string): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.lead.deleteMany({ where: { id } });
    if (result.count === 0) throw NotFound('Lead not found');
  });
}

export async function getLeadStats(organizationId: string) {
  return withTenant(organizationId, async (tx) => {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const total = await tx.lead.count();
    const grouped = await tx.lead.groupBy({ by: ['status'], _count: { _all: true } });
    const newThisWeek = await tx.lead.count({ where: { createdAt: { gte: sevenDaysAgo } } });

    const byStatus: Record<string, number> = {};
    for (const row of grouped) byStatus[row.status] = row._count._all;

    const open = total - (byStatus.WON ?? 0) - (byStatus.LOST ?? 0);

    return {
      total,
      open,
      won: byStatus.WON ?? 0,
      lost: byStatus.LOST ?? 0,
      newThisWeek,
      byStatus,
    };
  });
}
