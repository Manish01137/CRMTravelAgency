import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { withTenant } from '../../lib/prisma';
import { Conflict, NotFound } from '../../lib/errors';

/**
 * Inbox quick replies — saved messages an agent drops into a chat by typing
 * "/" and the shortcut (like WhatsApp Business). Shared by the whole team;
 * "{name}" in a message becomes the customer's first name when inserted.
 */

// "/Price list" → "price-list": lower case, letters / digits / - / _ only.
const shortcut = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().replace(/^\/+/, '').toLowerCase().replace(/\s+/g, '-') : v),
  z.string().min(1, 'Add a shortcut').max(30, 'Keep the shortcut under 30 characters').regex(/^[\p{L}\p{N}_-]+$/u, 'Use letters, numbers, - or _ only'),
);
const createSchema = z.object({
  shortcut,
  message: z.string().trim().min(1, 'Write the message').max(4096, 'WhatsApp messages can be up to 4096 characters'),
});
const updateSchema = createSchema.partial().refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });
const idParam = z.object({ id: z.string().uuid('Invalid quick reply id') });

const router = Router();
router.use(requireAuth);

const select = { id: true, shortcut: true, message: true, createdAt: true, updatedAt: true } as const;

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await withTenant(req.auth!.organizationId, (tx) => tx.quickReply.findMany({ orderBy: { shortcut: 'asc' }, select })));
  }),
);

/** Same shortcut twice would be ambiguous — say so instead of a database error. */
async function assertShortcutFree(organizationId: string, value: string, exceptId?: string) {
  const clash = await withTenant(organizationId, (tx) => tx.quickReply.findFirst({ where: { shortcut: value, ...(exceptId && { id: { not: exceptId } }) }, select: { id: true } }));
  if (clash) throw Conflict(`"/${value}" is already used by another quick reply`);
}

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.auth!.organizationId;
    const input = req.body as z.infer<typeof createSchema>;
    await assertShortcutFree(organizationId, input.shortcut);
    const created = await withTenant(organizationId, (tx) =>
      tx.quickReply.create({ data: { organizationId, ...input, createdById: req.auth!.userId }, select }),
    );
    res.status(201).json(created);
  }),
);

router.patch(
  '/:id',
  validate({ params: idParam, body: updateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.auth!.organizationId;
    const input = req.body as z.infer<typeof updateSchema>;
    if (input.shortcut) await assertShortcutFree(organizationId, input.shortcut, req.params.id);
    const updated = await withTenant(organizationId, async (tx) => {
      const existing = await tx.quickReply.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!existing) throw NotFound('Quick reply not found');
      return tx.quickReply.update({ where: { id: req.params.id }, data: input, select });
    });
    res.json(updated);
  }),
);

router.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await withTenant(req.auth!.organizationId, async (tx) => {
      const result = await tx.quickReply.deleteMany({ where: { id: req.params.id } });
      if (result.count === 0) throw NotFound('Quick reply not found');
    });
    res.json({ ok: true });
  }),
);

export default router;
