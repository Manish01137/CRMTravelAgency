import { Prisma } from '@prisma/client';
import { withTenant, type TenantTx } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/errors';
import type {
  CreateInvoiceInput,
  LineItem,
  ListInvoicesQuery,
  UpdateInvoiceInput,
} from './invoices.schemas';

const invoiceInclude = {
  booking: { select: { id: true, bookingNumber: true, destination: true } },
} satisfies Prisma.InvoiceInclude;

async function nextInvoiceNumber(tx: TenantTx): Promise<number> {
  const max = await tx.invoice.aggregate({ _max: { invoiceNumber: true } });
  return (max._max.invoiceNumber ?? 0) + 1;
}

/** Totals are always computed server-side from the line items. */
function computeTotals(items: LineItem[], taxPercent: number) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const taxAmount = Math.round((subtotal * taxPercent) / 100);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

export async function listInvoices(organizationId: string, query: ListInvoicesQuery) {
  return withTenant(organizationId, async (tx) => {
    const where: Prisma.InvoiceWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [{ customerName: { contains: query.search, mode: 'insensitive' } }];
    }
    const items = await tx.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy: { invoiceNumber: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    const total = await tx.invoice.count({ where });
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  });
}

export async function getInvoice(organizationId: string, id: string) {
  return withTenant(organizationId, async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id }, include: invoiceInclude });
    if (!invoice) throw NotFound('Invoice not found');
    return invoice;
  });
}

export async function createInvoice(organizationId: string, input: CreateInvoiceInput) {
  return withTenant(organizationId, async (tx) => {
    if (input.bookingId && !(await tx.booking.findUnique({ where: { id: input.bookingId } }))) {
      throw BadRequest('Booking not found in your organization');
    }
    const totals = computeTotals(input.items, input.taxPercent);
    return tx.invoice.create({
      data: {
        ...input,
        items: input.items,
        organizationId,
        invoiceNumber: await nextInvoiceNumber(tx),
        ...totals,
      },
      include: invoiceInclude,
    });
  });
}

/** Prefill an invoice draft from a booking (one line item with the trip). */
export async function createFromBooking(organizationId: string, bookingId: string) {
  return withTenant(organizationId, async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw NotFound('Booking not found');

    const items: LineItem[] = [
      {
        description: `${booking.destination} trip${booking.travelerCount ? ` · ${booking.travelerCount} traveller(s)` : ''}`,
        quantity: 1,
        unitPrice: booking.totalAmount,
      },
    ];
    const totals = computeTotals(items, 0);

    return tx.invoice.create({
      data: {
        organizationId,
        invoiceNumber: await nextInvoiceNumber(tx),
        bookingId: booking.id,
        customerName: booking.customerName,
        customerEmail: booking.customerEmail,
        customerPhone: booking.customerPhone,
        items,
        taxPercent: 0,
        currency: booking.currency,
        ...totals,
      },
      include: invoiceInclude,
    });
  });
}

export async function updateInvoice(organizationId: string, id: string, input: UpdateInvoiceInput) {
  return withTenant(organizationId, async (tx) => {
    const existing = await tx.invoice.findUnique({ where: { id } });
    if (!existing) throw NotFound('Invoice not found');

    const items = input.items ?? (existing.items as unknown as LineItem[]);
    const taxPercent = input.taxPercent ?? existing.taxPercent;
    const totals = computeTotals(items, taxPercent);

    return tx.invoice.update({
      where: { id },
      data: { ...input, items, taxPercent, ...totals },
      include: invoiceInclude,
    });
  });
}

export async function deleteInvoice(organizationId: string, id: string): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.invoice.deleteMany({ where: { id } });
    if (result.count === 0) throw NotFound('Invoice not found');
  });
}
