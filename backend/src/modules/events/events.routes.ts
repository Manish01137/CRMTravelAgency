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

const createBatchSchema = z.object({
  packageId: z.string().uuid(),
  departureDate: z.coerce.date(),
  capacity: z.coerce.number().int().min(1).max(100000).default(20),
  priceOverride: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().max(1_000_000_000).optional()),
  status: z.enum(['ON_SALE', 'CLOSED', 'SOLD_OUT']).default('ON_SALE'),
  notes: z.preprocess(emptyToUndefined, z.string().max(500).optional()),
});

const updateBatchSchema = z
  .object({
    departureDate: z.coerce.date().optional(),
    capacity: z.coerce.number().int().min(1).max(100000).optional(),
    priceOverride: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().max(1_000_000_000).nullable()).optional(),
    status: z.enum(['ON_SALE', 'CLOSED', 'SOLD_OUT']).optional(),
    notes: z.preprocess((v) => (v === '' ? null : v), z.string().max(500).nullable()).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

const idParam = z.object({ id: z.string().uuid('Invalid id') });

const router = Router();
router.use(requireAuth);

/** Booked seats per batch = non-cancelled bookings pointing at it. */
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

/** Events board: every package as an "event" with its dated batches + booked counts. */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await withTenant(req.auth!.organizationId, async (tx) => {
      const packages = await tx.package.findMany({
        orderBy: { createdAt: 'desc' },
        include: { batches: { orderBy: { departureDate: 'asc' } } },
      });
      const allBatchIds = packages.flatMap((p) => p.batches.map((b) => b.id));
      const booked = await bookedByBatch(tx, allBatchIds);

      return packages.map((p) => ({
        id: p.id,
        name: p.name,
        destination: p.destination,
        days: p.days,
        nights: p.nights,
        priceAmount: p.priceAmount,
        priceCurrency: p.priceCurrency,
        bannerImageUrl: p.bannerImageUrl,
        categories: p.categories,
        isActive: p.isActive,
        batches: p.batches.map((b) => ({
          id: b.id,
          departureDate: b.departureDate,
          capacity: b.capacity,
          priceOverride: b.priceOverride,
          status: b.status,
          notes: b.notes,
          booked: booked[b.id] ?? 0,
        })),
      }));
    });
    res.json(data);
  }),
);

/** Headline stats for the Events board. */
router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await withTenant(req.auth!.organizationId, async (tx) => {
      const liveEvents = await tx.package.count({ where: { isActive: true } });
      const totalBatches = await tx.batch.count();

      const now = new Date();
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const todays = await tx.booking.aggregate({
        _sum: { amountPaid: true },
        _count: { _all: true },
        where: { createdAt: { gte: dayStart, lt: dayEnd }, status: { not: 'CANCELLED' } },
      });

      // Pending settlement = collected but not fully paid trip value across live bookings.
      const outstanding = await tx.booking.aggregate({
        _sum: { totalAmount: true, amountPaid: true },
        where: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
      });

      return {
        liveEvents,
        totalBatches,
        todaysRevenue: todays._sum.amountPaid ?? 0,
        todaysBookings: todays._count._all,
        pendingSettlement: Math.max(0, (outstanding._sum.totalAmount ?? 0) - (outstanding._sum.amountPaid ?? 0)),
      };
    });
    res.json(stats);
  }),
);

router.post(
  '/batches',
  validate({ body: createBatchSchema }),
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
  '/batches/:id',
  validate({ params: idParam, body: updateBatchSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await withTenant(req.auth!.organizationId, async (tx) => {
      const existing = await tx.batch.findUnique({ where: { id: req.params.id } });
      if (!existing) throw NotFound('Batch not found');
      return tx.batch.update({ where: { id: req.params.id }, data: req.body });
    });
    res.json(updated);
  }),
);

router.delete(
  '/batches/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await withTenant(req.auth!.organizationId, async (tx) => {
      const result = await tx.batch.deleteMany({ where: { id: req.params.id } });
      if (result.count === 0) throw NotFound('Batch not found');
    });
    res.json({ ok: true });
  }),
);

export default router;
