import { Prisma } from '@prisma/client';
import { withTenant, type TenantTx } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/errors';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from './tasks.schemas';

const taskInclude = {
  assignedTo: { select: { id: true, name: true } },
  lead: { select: { id: true, name: true } },
  booking: { select: { id: true, customerName: true, bookingNumber: true } },
} satisfies Prisma.TaskInclude;

async function assertRefsInOrg(
  tx: TenantTx,
  refs: { leadId?: string | null; bookingId?: string | null; assignedToId?: string | null },
) {
  if (refs.leadId && !(await tx.lead.findUnique({ where: { id: refs.leadId } }))) {
    throw BadRequest('Lead not found in your organization');
  }
  if (refs.bookingId && !(await tx.booking.findUnique({ where: { id: refs.bookingId } }))) {
    throw BadRequest('Booking not found in your organization');
  }
  if (refs.assignedToId && !(await tx.user.findUnique({ where: { id: refs.assignedToId } }))) {
    throw BadRequest('Assigned team member not found in your organization');
  }
}

export async function listTasks(organizationId: string, query: ListTasksQuery) {
  return withTenant(organizationId, (tx) => {
    const where: Prisma.TaskWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.leadId) where.leadId = query.leadId;
    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.from || query.to) {
      where.dueAt = {
        ...(query.from ? { gte: query.from } : {}),
        ...(query.to ? { lte: query.to } : {}),
      };
    }
    return tx.task.findMany({ where, include: taskInclude, orderBy: { dueAt: 'asc' }, take: 500 });
  });
}

export async function createTask(organizationId: string, input: CreateTaskInput) {
  return withTenant(organizationId, async (tx) => {
    await assertRefsInOrg(tx, input);
    return tx.task.create({ data: { ...input, organizationId }, include: taskInclude });
  });
}

export async function updateTask(organizationId: string, id: string, input: UpdateTaskInput) {
  return withTenant(organizationId, async (tx) => {
    const existing = await tx.task.findUnique({ where: { id } });
    if (!existing) throw NotFound('Task not found');
    await assertRefsInOrg(tx, input);
    return tx.task.update({ where: { id }, data: input, include: taskInclude });
  });
}

export async function deleteTask(organizationId: string, id: string): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.task.deleteMany({ where: { id } });
    if (result.count === 0) throw NotFound('Task not found');
  });
}
