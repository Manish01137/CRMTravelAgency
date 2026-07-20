import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { withTenant } from '../../lib/prisma';
import { NotFound } from '../../lib/errors';

/**
 * LinkTree categories (per-org). Categories order the tabs on the public
 * LinkTree page; packages join them through package_categories. Deleting a
 * category never deletes packages — join rows cascade away, packages remain.
 */

const createSchema = z.object({ name: z.string().trim().min(1, 'Name is required').max(80) });
const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });
const reorderSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });
const idParam = z.object({ id: z.string().uuid('Invalid category id') });

const router = Router();
router.use(requireAuth);

/** List categories in tab order, each with its assigned-package count. */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const items = await withTenant(req.auth!.organizationId, async (tx) => {
      const cats = await tx.category.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { _count: { select: { packages: true } } },
      });
      return cats.map(({ _count, ...c }) => ({ ...c, packageCount: _count.packages }));
    });
    res.json(items);
  }),
);

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const created = await withTenant(req.auth!.organizationId, async (tx) => {
      const max = await tx.category.aggregate({ _max: { sortOrder: true } });
      return tx.category.create({
        data: {
          organizationId: req.auth!.organizationId,
          name: req.body.name,
          sortOrder: (max._max.sortOrder ?? -1) + 1,
        },
      });
    });
    res.status(201).json(created);
  }),
);

/** Persist a full drag-reorder: sortOrder = position in the ids array. */
router.put(
  '/reorder',
  validate({ body: reorderSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const ids: string[] = req.body.ids;
    await withTenant(req.auth!.organizationId, async (tx) => {
      for (let i = 0; i < ids.length; i++) {
        await tx.category.updateMany({ where: { id: ids[i] }, data: { sortOrder: i } });
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
      const existing = await tx.category.findUnique({ where: { id: req.params.id } });
      if (!existing) throw NotFound('Category not found');
      return tx.category.update({ where: { id: req.params.id }, data: req.body });
    });
    res.json(updated);
  }),
);

/** Delete a category. Packages keep existing — they just lose this tag. */
router.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await withTenant(req.auth!.organizationId, async (tx) => {
      const result = await tx.category.deleteMany({ where: { id: req.params.id } });
      if (result.count === 0) throw NotFound('Category not found');
    });
    res.json({ ok: true });
  }),
);

export default router;
