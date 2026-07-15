import { Prisma } from '@prisma/client';
import { withTenant, type TenantTx } from '../../lib/prisma';
import { BadRequest, NotFound } from '../../lib/errors';
import type {
  CreateBookingInput,
  CreateFromLeadInput,
  ItineraryInput,
  ListBookingsQuery,
  UpdateBookingInput,
} from './bookings.schemas';

const bookingInclude = {
  assignedTo: { select: { id: true, name: true, email: true } },
  package: { select: { id: true, name: true } },
  lead: { select: { id: true, name: true } },
} satisfies Prisma.BookingInclude;

/** Next per-org sequential booking number (unique constraint is the backstop). */
async function nextBookingNumber(tx: TenantTx): Promise<number> {
  const max = await tx.booking.aggregate({ _max: { bookingNumber: true } });
  return (max._max.bookingNumber ?? 0) + 1;
}

async function assertRefsInOrg(
  tx: TenantTx,
  refs: { packageId?: string | null; assignedToId?: string | null },
) {
  if (refs.packageId) {
    const pkg = await tx.package.findUnique({ where: { id: refs.packageId } });
    if (!pkg) throw BadRequest('Package not found in your organization');
  }
  if (refs.assignedToId) {
    const member = await tx.user.findUnique({ where: { id: refs.assignedToId } });
    if (!member) throw BadRequest('Assigned team member not found in your organization');
  }
}

export async function listBookings(organizationId: string, query: ListBookingsQuery) {
  return withTenant(organizationId, async (tx) => {
    const where: Prisma.BookingWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { customerName: { contains: query.search, mode: 'insensitive' } },
        { destination: { contains: query.search, mode: 'insensitive' } },
        { customerPhone: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const rows = await tx.booking.findMany({
      where,
      include: { ...bookingInclude, _count: { select: { itineraryItems: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    const items = rows.map(({ _count, ...b }) => ({ ...b, itineraryDays: _count.itineraryItems }));
    const total = await tx.booking.count({ where });
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  });
}

export async function getBooking(organizationId: string, id: string) {
  return withTenant(organizationId, async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id },
      include: {
        ...bookingInclude,
        itineraryItems: { orderBy: { dayNumber: 'asc' } },
        invoices: { orderBy: { invoiceNumber: 'desc' } },
        bills: { orderBy: { billDate: 'desc' } },
      },
    });
    if (!booking) throw NotFound('Booking not found');
    return booking;
  });
}

export async function createBooking(organizationId: string, input: CreateBookingInput) {
  return withTenant(organizationId, async (tx) => {
    await assertRefsInOrg(tx, input);
    return tx.booking.create({
      data: { ...input, organizationId, bookingNumber: await nextBookingNumber(tx) },
      include: bookingInclude,
    });
  });
}

/** Convert a lead into a booking (marks the lead WON). */
export async function createFromLead(
  organizationId: string,
  leadId: string,
  input: CreateFromLeadInput,
) {
  return withTenant(organizationId, async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw NotFound('Lead not found');
    await assertRefsInOrg(tx, input);

    const booking = await tx.booking.create({
      data: {
        organizationId,
        bookingNumber: await nextBookingNumber(tx),
        leadId: lead.id,
        customerName: input.customerName ?? lead.name,
        customerEmail: lead.email,
        customerPhone: lead.phone,
        destination: input.destination ?? lead.destination ?? 'To be decided',
        startDate: input.startDate ?? lead.travelDate,
        endDate: input.endDate,
        travelerCount: lead.travelerCount,
        totalAmount: input.totalAmount ?? lead.budgetAmount ?? 0,
        currency: lead.budgetCurrency ?? 'INR',
        packageId: input.packageId,
        assignedToId: lead.assignedToId,
      },
      include: bookingInclude,
    });

    if (lead.status !== 'WON') {
      await tx.lead.update({ where: { id: lead.id }, data: { status: 'WON' } });
    }
    return booking;
  });
}

export async function updateBooking(organizationId: string, id: string, input: UpdateBookingInput) {
  return withTenant(organizationId, async (tx) => {
    const existing = await tx.booking.findUnique({ where: { id } });
    if (!existing) throw NotFound('Booking not found');
    await assertRefsInOrg(tx, input);
    return tx.booking.update({ where: { id }, data: input, include: bookingInclude });
  });
}

export async function deleteBooking(organizationId: string, id: string): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.booking.deleteMany({ where: { id } });
    if (result.count === 0) throw NotFound('Booking not found');
  });
}

/** Replace the full itinerary for a booking (simplest reliable editor model). */
export async function setItinerary(organizationId: string, bookingId: string, input: ItineraryInput) {
  return withTenant(organizationId, async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw NotFound('Booking not found');

    await tx.itineraryItem.deleteMany({ where: { bookingId } });
    if (input.items.length > 0) {
      await tx.itineraryItem.createMany({
        data: input.items.map((item) => ({ ...item, organizationId, bookingId })),
      });
    }
    return tx.itineraryItem.findMany({ where: { bookingId }, orderBy: { dayNumber: 'asc' } });
  });
}

export async function getBookingStats(organizationId: string) {
  return withTenant(organizationId, async (tx) => {
    const total = await tx.booking.count();
    const grouped = await tx.booking.groupBy({ by: ['status'], _count: { _all: true } });
    const byStatus: Record<string, number> = {};
    for (const row of grouped) byStatus[row.status] = row._count._all;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const departingThisMonth = await tx.booking.count({
      where: { startDate: { gte: monthStart, lt: monthEnd } },
    });

    const sums = await tx.booking.aggregate({
      _sum: { totalAmount: true, amountPaid: true },
      where: { status: { notIn: ['CANCELLED'] } },
    });

    return {
      total,
      byStatus,
      departingThisMonth,
      totalValue: sums._sum.totalAmount ?? 0,
      totalCollected: sums._sum.amountPaid ?? 0,
    };
  });
}
