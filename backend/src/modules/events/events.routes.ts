import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { withTenant } from '../../lib/prisma';
import { AppError, NotFound, BadRequest } from '../../lib/errors';
import { createBookingFromLeadTx } from '../bookings/bookings.service';
import { assertLeadVisible, bookingScope, leadScope, seesEverything, viewerOf } from '../../lib/visibility';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const emptyToNull = (v: unknown) => (v === '' ? null : v);

const EventStatusEnum = z.enum(['DRAFT', 'LIVE', 'COMPLETED', 'CANCELLED']);

const createEventSchema = z.object({
  packageId: z.string().uuid(),
  name: z.preprocess(emptyToUndefined, z.string().trim().max(160).optional()),
  departureDate: z.coerce.date(),
  returnDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  bookingCloseDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  capacity: z.coerce.number().int().min(1).max(100000).default(20),
  pricePerPerson: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().max(1_000_000_000).optional()),
  pickupCity: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  coverImageOverride: z.preprocess(emptyToUndefined, z.string().url().max(2000).optional()),
  status: EventStatusEnum.default('DRAFT'),
  notes: z.preprocess(emptyToUndefined, z.string().max(1000).optional()),
});

const updateEventSchema = z
  .object({
    name: z.preprocess(emptyToNull, z.string().trim().max(160).nullable()).optional(),
    departureDate: z.coerce.date().optional(),
    returnDate: z.preprocess(emptyToNull, z.coerce.date().nullable()).optional(),
    bookingCloseDate: z.preprocess(emptyToNull, z.coerce.date().nullable()).optional(),
    capacity: z.coerce.number().int().min(1).max(100000).optional(),
    pricePerPerson: z.preprocess(emptyToNull, z.coerce.number().int().nonnegative().max(1_000_000_000).nullable()).optional(),
    pickupCity: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()).optional(),
    coverImageOverride: z.preprocess(emptyToNull, z.string().url().max(2000).nullable()).optional(),
    status: EventStatusEnum.optional(),
    notes: z.preprocess(emptyToNull, z.string().max(1000).nullable()).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

const idParam = z.object({ id: z.string().uuid('Invalid event id') });
const eventLeadParam = z.object({ id: z.string().uuid('Invalid event id'), leadId: z.string().uuid('Invalid lead id') });

// Assigning existing leads to an event — links the original lead, never a copy.
const addLeadsSchema = z.object({ leadIds: z.array(z.string().uuid()).min(1, 'Choose at least one lead').max(100) });
const updateEventLeadSchema = z.object({ travelerCount: z.coerce.number().int().min(1).max(1000) });
const convertLeadSchema = z.object({
  travelerCount: z.coerce.number().int().min(1).max(1000),
  // Defaults to price per person × travellers.
  totalAmount: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().max(1_000_000_000).optional()),
  amountPaid: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().max(1_000_000_000).optional()),
});

const router = Router();
router.use(requireAuth);

const pkgSelect = {
  id: true,
  name: true,
  destination: true,
  days: true,
  nights: true,
  priceAmount: true,
  priceCurrency: true,
  bannerImageUrl: true,
} satisfies Prisma.PackageSelect;

/** Non-cancelled seats booked per batch. */
async function bookedByBatch(tx: Prisma.TransactionClient, batchIds: string[]): Promise<Record<string, number>> {
  if (batchIds.length === 0) return {};
  const grouped = await tx.booking.groupBy({
    by: ['batchId'],
    where: { batchId: { in: batchIds }, status: { not: 'CANCELLED' } },
    _count: { _all: true },
  });
  const map: Record<string, number> = {};
  for (const g of grouped) if (g.batchId) map[g.batchId] = g._count._all;
  return map;
}

/** Travellers on non-cancelled bookings per batch — the seats actually taken (a booking without a count is 1). */
async function seatsByBatch(tx: Prisma.TransactionClient, batchIds: string[]): Promise<Record<string, number>> {
  if (batchIds.length === 0) return {};
  const rows = await tx.booking.findMany({
    where: { batchId: { in: batchIds }, status: { not: 'CANCELLED' } },
    select: { batchId: true, travelerCount: true },
  });
  const map: Record<string, number> = {};
  for (const r of rows) if (r.batchId) map[r.batchId] = (map[r.batchId] ?? 0) + (r.travelerCount ?? 1);
  return map;
}

/** Leads assigned to each batch. */
async function leadsByBatch(tx: Prisma.TransactionClient, batchIds: string[]): Promise<Record<string, number>> {
  if (batchIds.length === 0) return {};
  const grouped = await tx.eventLead.groupBy({ by: ['batchId'], where: { batchId: { in: batchIds } }, _count: { _all: true } });
  return Object.fromEntries(grouped.map((g) => [g.batchId, g._count._all]));
}

function shapeEvent(b: any, booked: number, extra: { seatsBooked?: number; leadCount?: number } = {}) {
  const pkg = b.package;
  return {
    id: b.id,
    packageId: b.packageId,
    packageName: pkg.name,
    destination: pkg.destination,
    days: pkg.days,
    nights: pkg.nights,
    coverImage: b.coverImageOverride || pkg.bannerImageUrl,
    name: b.name,
    departureDate: b.departureDate,
    returnDate: b.returnDate,
    bookingCloseDate: b.bookingCloseDate,
    capacity: b.capacity,
    pricePerPerson: b.pricePerPerson ?? pkg.priceAmount,
    priceCurrency: pkg.priceCurrency,
    pickupCity: b.pickupCity,
    status: b.status,
    notes: b.notes,
    booked,
    seatsBooked: extra.seatsBooked ?? 0,
    leadCount: extra.leadCount ?? 0,
  };
}

/** Events board: a flat list of departures, each with its package summary. */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await withTenant(req.auth!.organizationId, async (tx) => {
      const batches = await tx.batch.findMany({
        orderBy: { departureDate: 'asc' },
        include: { package: { select: pkgSelect } },
      });
      const ids = batches.map((b) => b.id);
      const booked = await bookedByBatch(tx, ids);
      const seats = await seatsByBatch(tx, ids);
      const leads = await leadsByBatch(tx, ids);
      return batches.map((b) => shapeEvent(b, booked[b.id] ?? 0, { seatsBooked: seats[b.id] ?? 0, leadCount: leads[b.id] ?? 0 }));
    });
    res.json(data);
  }),
);

/** Headline stats for the Events board. */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await withTenant(req.auth!.organizationId, async (tx) => {
      const liveEvents = await tx.batch.count({ where: { status: 'LIVE' } });
      const totalEvents = await tx.batch.count();

      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const todays = await tx.booking.aggregate({
        _sum: { amountPaid: true },
        _count: { _all: true },
        where: { createdAt: { gte: dayStart, lt: dayEnd }, status: { not: 'CANCELLED' } },
      });
      const outstanding = await tx.booking.aggregate({
        _sum: { totalAmount: true, amountPaid: true },
        where: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
      });

      return {
        liveEvents,
        totalEvents,
        todaysRevenue: todays._sum.amountPaid ?? 0,
        todaysBookings: todays._count._all,
        pendingSettlement: Math.max(0, (outstanding._sum.totalAmount ?? 0) - (outstanding._sum.amountPaid ?? 0)),
      };
    });
    res.json(stats);
  }),
);

/** Manage Departure: the event + package + its bookings (passengers) + money. */
router.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const data = await withTenant(req.auth!.organizationId, async (tx) => {
      const batch = await tx.batch.findUnique({
        where: { id: req.params.id },
        include: { package: { select: pkgSelect } },
      });
      if (!batch) throw NotFound('Event not found');

      const bookings = await tx.booking.findMany({
        where: { batchId: batch.id },
        select: {
          id: true,
          bookingNumber: true,
          customerName: true,
          customerPhone: true,
          travelerCount: true,
          status: true,
          totalAmount: true,
          amountPaid: true,
          currency: true,
          assignedTo: { select: { id: true, name: true } },
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const active = bookings.filter((b) => b.status !== 'CANCELLED');
      const booked = active.reduce((s, b) => s + (b.travelerCount ?? 1), 0);
      // Seats are for the whole event; an agent's passenger list and money are only their own bookings.
      const viewer = viewerOf(req);
      const mine = seesEverything(viewer)
        ? null
        : new Set((await tx.booking.findMany({ where: { batchId: batch.id, ...bookingScope(viewer) }, select: { id: true } })).map((b) => b.id));
      const shown = mine ? bookings.filter((b) => mine.has(b.id)) : bookings;
      const shownActive = shown.filter((b) => b.status !== 'CANCELLED');
      const revenue = shownActive.reduce((s, b) => s + b.amountPaid, 0);
      const pending = shownActive.reduce((s, b) => s + Math.max(0, b.totalAmount - b.amountPaid), 0);

      // Leads assigned to this event (the original lead records).
      const links = await tx.eventLead.findMany({
        // An agent sees only their own leads here too (lib/visibility.ts).
        where: { batchId: batch.id, lead: leadScope(viewerOf(req)) },
        orderBy: { createdAt: 'desc' },
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              status: true,
              source: true,
              destination: true,
              travelerCount: true,
              assignedTo: { select: { id: true, name: true } },
            },
          },
          booking: { select: { id: true, bookingNumber: true, status: true, travelerCount: true } },
        },
      });
      // A lead booked onto this event some other way (e.g. from the Leads page) counts as converted too.
      const bookingByLead = new Map(
        (await tx.booking.findMany({
          where: { batchId: batch.id, leadId: { in: links.map((l) => l.leadId) }, status: { not: 'CANCELLED' } },
          select: { id: true, bookingNumber: true, status: true, travelerCount: true, leadId: true },
        })).map((bk) => [bk.leadId!, bk]),
      );
      const leads = links.map((l) => {
        const bk = l.booking && l.booking.status !== 'CANCELLED' ? l.booking : bookingByLead.get(l.leadId) ?? null;
        return {
          id: l.id,
          travelerCount: l.travelerCount ?? l.lead.travelerCount ?? 1,
          addedAt: l.createdAt,
          lead: l.lead,
          booking: bk ? { id: bk.id, bookingNumber: bk.bookingNumber, status: bk.status, travelerCount: bk.travelerCount } : null,
        };
      });

      return {
        event: shapeEvent(batch, active.length, { seatsBooked: booked, leadCount: links.length }),
        seatsBooked: booked,
        seatsRemaining: Math.max(0, batch.capacity - booked),
        revenue,
        pending,
        bookings: shown,
        leads,
      };
    });
    res.json(data);
  }),
);

router.post(
  '/',
  validate({ body: createEventSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const created = await withTenant(req.auth!.organizationId, async (tx) => {
      const pkg = await tx.package.findUnique({ where: { id: req.body.packageId } });
      if (!pkg) throw BadRequest('Package not found in your organization');
      return tx.batch.create({ data: { ...req.body, organizationId: req.auth!.organizationId } });
    });
    res.status(201).json(created);
  }),
);

router.patch(
  '/:id',
  validate({ params: idParam, body: updateEventSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await withTenant(req.auth!.organizationId, async (tx) => {
      const existing = await tx.batch.findUnique({ where: { id: req.params.id } });
      if (!existing) throw NotFound('Event not found');
      return tx.batch.update({ where: { id: req.params.id }, data: req.body });
    });
    res.json(updated);
  }),
);

router.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await withTenant(req.auth!.organizationId, async (tx) => {
      const result = await tx.batch.deleteMany({ where: { id: req.params.id } });
      if (result.count === 0) throw NotFound('Event not found');
    });
    res.json({ ok: true });
  }),
);

// --- Leads assigned to an event ---------------------------------------------

/** Add existing leads to the event (already-added ones are skipped — never duplicated). */
router.post(
  '/:id/leads',
  validate({ params: idParam, body: addLeadsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.auth!.organizationId;
    const { leadIds } = req.body as z.infer<typeof addLeadsSchema>;
    const result = await withTenant(organizationId, async (tx) => {
      const batch = await tx.batch.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!batch) throw NotFound('Event not found');
      const unique = [...new Set(leadIds)];
      // RLS: this org's only; an agent can only add their own leads.
      const leads = await tx.lead.findMany({ where: { id: { in: unique }, ...leadScope(viewerOf(req)) }, select: { id: true, travelerCount: true } });
      if (leads.length !== unique.length) throw BadRequest('A selected lead was not found in your organization');
      const created = await tx.eventLead.createMany({
        data: leads.map((l) => ({ organizationId, batchId: batch.id, leadId: l.id, travelerCount: l.travelerCount, addedById: req.auth!.userId })),
        skipDuplicates: true,
      });
      return { added: created.count, alreadyInEvent: leads.length - created.count };
    });
    res.status(201).json(result);
  }),
);

/** Change how many travellers a lead is expected to bring. */
router.patch(
  '/:id/leads/:leadId',
  validate({ params: eventLeadParam, body: updateEventLeadSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await assertLeadVisible(req.auth!.organizationId, viewerOf(req), req.params.leadId);
    const updated = await withTenant(req.auth!.organizationId, async (tx) => {
      const result = await tx.eventLead.updateMany({
        where: { batchId: req.params.id, leadId: req.params.leadId },
        data: { travelerCount: (req.body as z.infer<typeof updateEventLeadSchema>).travelerCount },
      });
      if (result.count === 0) throw NotFound('This lead is not in the event');
      return { ok: true };
    });
    res.json(updated);
  }),
);

/** Remove a lead from the event. The lead itself, and any booking, are untouched. */
router.delete(
  '/:id/leads/:leadId',
  validate({ params: eventLeadParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await assertLeadVisible(req.auth!.organizationId, viewerOf(req), req.params.leadId);
    await withTenant(req.auth!.organizationId, async (tx) => {
      const result = await tx.eventLead.deleteMany({ where: { batchId: req.params.id, leadId: req.params.leadId } });
      if (result.count === 0) throw NotFound('This lead is not in the event');
    });
    res.json({ ok: true });
  }),
);

/**
 * Convert an assigned lead into a confirmed booking for this event: the normal
 * lead → booking conversion (same booking numbers, linked to the lead, lead
 * marked Won), pinned to this departure, with a seat check against capacity.
 */
router.post(
  '/:id/leads/:leadId/convert',
  validate({ params: eventLeadParam, body: convertLeadSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await assertLeadVisible(req.auth!.organizationId, viewerOf(req), req.params.leadId);
    const organizationId = req.auth!.organizationId;
    const input = req.body as z.infer<typeof convertLeadSchema>;
    const booking = await withTenant(organizationId, async (tx) => {
      const batch = await tx.batch.findUnique({ where: { id: req.params.id }, include: { package: { select: pkgSelect } } });
      if (!batch) throw NotFound('Event not found');
      const link = await tx.eventLead.findUnique({ where: { batchId_leadId: { batchId: batch.id, leadId: req.params.leadId } } });
      if (!link) throw NotFound('Add this lead to the event first');
      const lead = await tx.lead.findUnique({ where: { id: req.params.leadId } });
      if (!lead) throw NotFound('Lead not found');

      const existing = await tx.booking.findFirst({
        where: { batchId: batch.id, leadId: lead.id, status: { not: 'CANCELLED' } },
        select: { id: true, bookingNumber: true },
      });
      if (existing) throw new AppError(409, 'ALREADY_BOOKED', `This lead already has a booking for this event (BK-${String(existing.bookingNumber).padStart(4, '0')})`);

      const seats = (await seatsByBatch(tx, [batch.id]))[batch.id] ?? 0;
      const left = batch.capacity - seats;
      if (input.travelerCount > left) {
        throw BadRequest(left <= 0 ? 'This event is full — no seats left' : `Only ${left} seat${left === 1 ? '' : 's'} left on this event`);
      }

      const pricePerPerson = batch.pricePerPerson ?? batch.package.priceAmount ?? 0;
      const created = await createBookingFromLeadTx(tx, organizationId, lead, {
        batchId: batch.id,
        packageId: batch.packageId,
        destination: batch.package.destination,
        startDate: batch.departureDate,
        endDate: batch.returnDate ?? undefined,
        totalAmount: input.totalAmount ?? pricePerPerson * input.travelerCount,
      });
      const bookingRow = await tx.booking.update({
        where: { id: created.id },
        data: { travelerCount: input.travelerCount, currency: batch.package.priceCurrency, ...(input.amountPaid != null && { amountPaid: input.amountPaid }) },
        select: { id: true, bookingNumber: true },
      });
      await tx.eventLead.update({ where: { id: link.id }, data: { bookingId: bookingRow.id, travelerCount: input.travelerCount } });
      // The lead's timeline shows it (same entries as a stage move on the Leads page).
      const actorId = req.auth!.userId ?? null;
      if (lead.status !== 'WON') {
        await tx.lead.update({ where: { id: lead.id }, data: { status: 'WON' } });
        await tx.leadActivity.create({
          data: { organizationId, leadId: lead.id, type: 'STATUS_CHANGE', fromStatus: lead.status, toStatus: 'WON', createdById: actorId },
        });
      }
      await tx.leadActivity.create({
        data: {
          organizationId,
          leadId: lead.id,
          type: 'NOTE',
          message: `Booked on event "${batch.name || batch.package.name}" — BK-${String(bookingRow.bookingNumber).padStart(4, '0')}, ${input.travelerCount} traveller${input.travelerCount === 1 ? '' : 's'}`,
          createdById: actorId,
        },
      });
      return bookingRow;
    });
    res.status(201).json(booking);
  }),
);

export default router;
