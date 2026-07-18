import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { withTenant } from '../../lib/prisma';
import { NotFound, BadRequest } from '../../lib/errors';

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

function shapeEvent(b: any, booked: number) {
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
      const booked = await bookedByBatch(tx, batches.map((b) => b.id));
      return batches.map((b) => shapeEvent(b, booked[b.id] ?? 0));
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
      const revenue = active.reduce((s, b) => s + b.amountPaid, 0);
      const pending = active.reduce((s, b) => s + Math.max(0, b.totalAmount - b.amountPaid), 0);

      return {
        event: shapeEvent(batch, active.length),
        seatsBooked: booked,
        seatsRemaining: Math.max(0, batch.capacity - booked),
        revenue,
        pending,
        bookings,
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

export default router;
