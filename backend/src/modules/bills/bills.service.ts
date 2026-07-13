import { Prisma } from '@prisma/client';
import { withTenant } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/errors';
import type { CreateBillInput, ListBillsQuery, UpdateBillInput } from './bills.schemas';

const billInclude = {
  booking: { select: { id: true, bookingNumber: true, customerName: true } },
} satisfies Prisma.BillInclude;

export async function listBills(organizationId: string, query: ListBillsQuery) {
  return withTenant(organizationId, (tx) => {
    const where: Prisma.BillWhereInput = {};
    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.status) where.status = query.status;
    return tx.bill.findMany({ where, include: billInclude, orderBy: { billDate: 'desc' }, take: 500 });
  });
}

export async function createBill(organizationId: string, input: CreateBillInput) {
  return withTenant(organizationId, async (tx) => {
    if (input.bookingId && !(await tx.booking.findUnique({ where: { id: input.bookingId } }))) {
      throw BadRequest('Booking not found in your organization');
    }
    return tx.bill.create({ data: { ...input, organizationId }, include: billInclude });
  });
}

export async function updateBill(organizationId: string, id: string, input: UpdateBillInput) {
  return withTenant(organizationId, async (tx) => {
    const existing = await tx.bill.findUnique({ where: { id } });
    if (!existing) throw NotFound('Bill not found');
    return tx.bill.update({ where: { id }, data: input, include: billInclude });
  });
}

export async function deleteBill(organizationId: string, id: string): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.bill.deleteMany({ where: { id } });
    if (result.count === 0) throw NotFound('Bill not found');
  });
}
