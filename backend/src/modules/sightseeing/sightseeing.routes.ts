import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { withTenant } from '../../lib/prisma';
import { NotFound } from '../../lib/errors';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const emptyToNull = (v: unknown) => (v === '' ? null : v);

// Simplified library: an activity is just Name + Cover Image + Description.
// (city/country/timings/points columns remain for back-compat but default to blank.)
const createSchema = z.object({
  name: z.string().trim().min(1, 'Activity name is required').max(200),
  imageUrl: z.preprocess(emptyToUndefined, z.string().url().max(2000).optional()),
  notes: z.preprocess(emptyToUndefined, z.string().max(4000).optional()), // description
  city: z.string().trim().max(100).default(''),
  country: z.string().trim().max(100).default(''),
  timings: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  points: z.coerce.number().int().min(0).max(100).default(0),
  isActive: z.coerce.boolean().default(true),
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    imageUrl: z.preprocess(emptyToNull, z.string().url().max(2000).nullable()).optional(),
    notes: z.preprocess(emptyToNull, z.string().max(4000).nullable()).optional(),
    city: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    timings: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()).optional(),
    points: z.coerce.number().int().min(0).max(100).optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

const listQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
});

const idParam = z.object({ id: z.string().uuid('Invalid activity id') });

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as z.infer<typeof listQuerySchema>;
    const items = await withTenant(req.auth!.organizationId, (tx) => {
      const where: Prisma.SightseeingWhereInput = {};
      if (q.search) {
        where.OR = [
          { name: { contains: q.search, mode: 'insensitive' } },
          { city: { contains: q.search, mode: 'insensitive' } },
        ];
      }
      if (q.city) where.city = { equals: q.city, mode: 'insensitive' };
      if (q.country) where.country = { equals: q.country, mode: 'insensitive' };
      return tx.sightseeing.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 });
    });
    res.json(items);
  }),
);

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const created = await withTenant(req.auth!.organizationId, (tx) =>
      tx.sightseeing.create({ data: { ...req.body, organizationId: req.auth!.organizationId } }),
    );
    res.status(201).json(created);
  }),
);

router.patch(
  '/:id',
  validate({ params: idParam, body: updateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await withTenant(req.auth!.organizationId, async (tx) => {
      const existing = await tx.sightseeing.findUnique({ where: { id: req.params.id } });
      if (!existing) throw NotFound('Activity not found');
      return tx.sightseeing.update({ where: { id: req.params.id }, data: req.body });
    });
    res.json(updated);
  }),
);

router.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await withTenant(req.auth!.organizationId, async (tx) => {
      const result = await tx.sightseeing.deleteMany({ where: { id: req.params.id } });
      if (result.count === 0) throw NotFound('Activity not found');
    });
    res.json({ ok: true });
  }),
);

export default router;
