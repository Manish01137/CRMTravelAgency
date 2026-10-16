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

/**
 * Keeps "amount paid" and the Paid/Unpaid status in step:
 *  - an amount paid given → status follows it (Paid once the whole bill is paid);
 *  - only a status given (the Mark paid / unpaid button) → paid in full / nothing paid;
 *  - only the total changed → status re-checked against what was already paid.
 */
function settle(
  amount: number,
  input: { amountPaid?: number; status?: 'PAID' | 'UNPAID' },
  current: { amountPaid: number; status: 'PAID' | 'UNPAID' } | null,
): { amountPaid: number; status: 'PAID' | 'UNPAID' } {
  let amountPaid: number;
  if (input.amountPaid !== undefined) amountPaid = input.amountPaid;
  else if (input.status) amountPaid = input.status === 'PAID' ? amount : 0;
  else if (current) amountPaid = current.status === 'PAID' && current.amountPaid >= amount ? amount : current.amountPaid;
  else amountPaid = 0;
  if (amountPaid > amount) throw BadRequest("Amount paid can't be more than the total amount");
  // A ₹0 bill has nothing to pay — it keeps whichever status it was given.
  if (amount === 0) return { amountPaid: 0, status: input.status ?? current?.status ?? 'UNPAID' };
  return { amountPaid, status: amountPaid >= amount ? 'PAID' : 'UNPAID' };
}

export async function createBill(organizationId: string, input: CreateBillInput) {
  return withTenant(organizationId, async (tx) => {
    if (input.bookingId && !(await tx.booking.findUnique({ where: { id: input.bookingId } }))) {
      throw BadRequest('Booking not found in your organization');
    }
    const paid = settle(input.amount, { amountPaid: input.amountPaid, status: input.amountPaid === undefined ? input.status : undefined }, null);
    return tx.bill.create({ data: { ...input, ...paid, organizationId }, include: billInclude });
  });
}

export async function updateBill(organizationId: string, id: string, input: UpdateBillInput) {
  return withTenant(organizationId, async (tx) => {
    const existing = await tx.bill.findUnique({ where: { id } });
    if (!existing) throw NotFound('Bill not found');
    const paid = settle(input.amount ?? existing.amount, input, existing);
    return tx.bill.update({ where: { id }, data: { ...input, ...paid }, include: billInclude });
  });
}

export async function deleteBill(organizationId: string, id: string): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.bill.deleteMany({ where: { id } });
    if (result.count === 0) throw NotFound('Bill not found');
  });
}
