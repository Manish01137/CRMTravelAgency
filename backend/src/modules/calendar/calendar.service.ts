import { withTenant } from '../../lib/prisma';
import { NotFound } from '../../lib/errors';
import type { Prisma } from '@prisma/client';
import type { CalendarQuery, CreateEventInput, UpdateEventInput } from './calendar.schemas';

export async function createEvent(organizationId: string, input: CreateEventInput) {
  return withTenant(organizationId, (tx) => tx.event.create({ data: { ...input, organizationId } }));
}

export async function updateEvent(organizationId: string, id: string, input: UpdateEventInput) {
  return withTenant(organizationId, async (tx) => {
    const existing = await tx.event.findUnique({ where: { id } });
    if (!existing) throw NotFound('Event not found');
    return tx.event.update({ where: { id }, data: input });
  });
}

export async function deleteEvent(organizationId: string, id: string): Promise<void> {
  await withTenant(organizationId, async (tx) => {
    const result = await tx.event.deleteMany({ where: { id } });
    if (result.count === 0) throw NotFound('Event not found');
  });
}

/**
 * Merged calendar feed for a date range: manual events + booking departures &
 * returns + due tasks. Everything org-scoped through RLS as usual.
 */
export async function getCalendarFeed(organizationId: string, query: CalendarQuery, bookings: Prisma.BookingWhereInput = {}) {
  return withTenant(organizationId, async (tx) => {
    const events = await tx.event.findMany({
      where: { date: { gte: query.from, lte: query.to } },
      orderBy: { date: 'asc' },
    });

    const departures = await tx.booking.findMany({
      where: { AND: [bookings], startDate: { gte: query.from, lte: query.to }, status: { not: 'CANCELLED' } },
      select: {
        id: true,
        bookingNumber: true,
        customerName: true,
        destination: true,
        startDate: true,
        status: true,
      },
      orderBy: { startDate: 'asc' },
    });

    const returns = await tx.booking.findMany({
      where: { AND: [bookings], endDate: { gte: query.from, lte: query.to }, status: { not: 'CANCELLED' } },
      select: {
        id: true,
        bookingNumber: true,
        customerName: true,
        destination: true,
        endDate: true,
        status: true,
      },
      orderBy: { endDate: 'asc' },
    });

    const tasks = await tx.task.findMany({
      where: { dueAt: { gte: query.from, lte: query.to } },
      select: { id: true, title: true, dueAt: true, status: true, type: true },
      orderBy: { dueAt: 'asc' },
    });

    return { events, departures, returns, tasks };
  });
}
