import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { withTenant } from '../../lib/prisma';
import { NotFound } from '../../lib/errors';

/** Host Page reviews (manually curated by the agency). */
const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const emptyToNull = (v: unknown) => (v === '' ? null : v);

const createSchema = z.object({
  reviewerName: z.string().trim().min(1, 'Reviewer name is required').max(120),
  quote: z.string().trim().min(1, 'Quote is required').max(2000),
  photoUrl: z.preprocess(emptyToUndefined, z.string().url().max(2000).optional()),
  rating: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(5).optional()),
});
const updateSchema = z
  .object({
    reviewerName: z.string().trim().min(1).max(120).optional(),
    quote: z.string().trim().min(1).max(2000).optional(),
    photoUrl: z.preprocess(emptyToNull, z.string().url().max(2000).nullable()).optional(),
    rating: z.preprocess(emptyToNull, z.coerce.number().int().min(1).max(5).nullable()).optional(),
    sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });
const reorderSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });
const idParam = z.object({ id: z.string().uuid('Invalid review id') });

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const items = await withTenant(req.auth!.organizationId, (tx) =>
      tx.hostReview.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    );
    res.json(items);
  }),
);

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const created = await withTenant(req.auth!.organizationId, async (tx) => {
      const max = await tx.hostReview.aggregate({ _max: { sortOrder: true } });
      return tx.hostReview.create({
        data: { ...req.body, organizationId: req.auth!.organizationId, sortOrder: (max._max.sortOrder ?? -1) + 1 },
      });
    });
    res.status(201).json(created);
  }),
);

router.put(
  '/reorder',
  validate({ body: reorderSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const ids: string[] = req.body.ids;
    await withTenant(req.auth!.organizationId, async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.hostReview.updateMany({ where: { id: ids[i] }, data: { sortOrder: i } });
      }
    });
    res.json({ ok: true });
  }),
);

router.patch(
  '/:id',
  validate({ params: idParam, body: updateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await withTenant(req.auth!.organizationId, async (tx) => {
      const existing = await tx.hostReview.findUnique({ where: { id: req.params.id } });
      if (!existing) throw NotFound('Review not found');
      return tx.hostReview.update({ where: { id: req.params.id }, data: req.body });
    });
    res.json(updated);
  }),
);

router.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await withTenant(req.auth!.organizationId, async (tx) => {
      const result = await tx.hostReview.deleteMany({ where: { id: req.params.id } });
      if (result.count === 0) throw NotFound('Review not found');
    });
    res.json({ ok: true });
  }),
);

export default router;
