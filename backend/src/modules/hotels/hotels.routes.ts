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

const createHotelSchema = z.object({
  name: z.string().trim().min(1, 'Hotel name is required').max(150),
  city: z.string().trim().min(1, 'City is required').max(100),
  address: z.preprocess(emptyToUndefined, z.string().max(300).optional()),
  starRating: z.coerce.number().int().min(1).max(5).default(3),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  email: z.preprocess(emptyToUndefined, z.string().email('Enter a valid email').max(200).optional()),
  pricePerNight: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().max(1_000_000_000).optional()),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  notes: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  images: z.array(z.string().url().max(2000)).max(12).default([]),
  isActive: z.coerce.boolean().default(true),
});

const updateHotelSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    address: z.preprocess(emptyToNull, z.string().max(300).nullable()).optional(),
    starRating: z.coerce.number().int().min(1).max(5).optional(),
    phone: z.preprocess(emptyToNull, z.string().trim().max(40).nullable()).optional(),
    email: z.preprocess(emptyToNull, z.string().email().max(200).nullable()).optional(),
    pricePerNight: z.preprocess(emptyToNull, z.coerce.number().int().nonnegative().max(1_000_000_000).nullable()).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    notes: z.preprocess(emptyToNull, z.string().max(2000).nullable()).optional(),
    images: z.array(z.string().url().max(2000)).max(12).optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

const listQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  active: z.enum(['true', 'false']).optional(),
});

const idParam = z.object({ id: z.string().uuid('Invalid hotel id') });

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as unknown as z.infer<typeof listQuerySchema>;
    const hotels = await withTenant(req.auth!.organizationId, (tx) => {
      const where: Prisma.HotelWhereInput = {};
      if (query.active) where.isActive = query.active === 'true';
      if (query.search) {
        where.OR = [
          { name: { contains: query.search, mode: 'insensitive' } },
          { city: { contains: query.search, mode: 'insensitive' } },
        ];
      }
      return tx.hotel.findMany({ where, orderBy: [{ city: 'asc' }, { name: 'asc' }] });
    });
    res.json(hotels);
  }),
);

router.post(
  '/',
  validate({ body: createHotelSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const hotel = await withTenant(req.auth!.organizationId, (tx) =>
      tx.hotel.create({ data: { ...req.body, organizationId: req.auth!.organizationId } }),
    );
    res.status(201).json(hotel);
  }),
);

router.patch(
  '/:id',
  validate({ params: idParam, body: updateHotelSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const hotel = await withTenant(req.auth!.organizationId, async (tx) => {
      const existing = await tx.hotel.findUnique({ where: { id: req.params.id } });
      if (!existing) throw NotFound('Hotel not found');
      return tx.hotel.update({ where: { id: req.params.id }, data: req.body });
    });
    res.json(hotel);
  }),
);

router.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await withTenant(req.auth!.organizationId, async (tx) => {
      const result = await tx.hotel.deleteMany({ where: { id: req.params.id } });
      if (result.count === 0) throw NotFound('Hotel not found');
    });
    res.json({ ok: true });
  }),
);

export default router;
