import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { withTenant } from '../../lib/prisma';
import { Conflict, NotFound } from '../../lib/errors';

/**
 * Inbox quick replies — saved messages an agent drops into a chat with one tap
 * (the buttons above the message box), or by typing "/" + the shortcut (like
 * WhatsApp Business). Shared by the whole team; "{name}" in a message becomes
 * the customer's first name when inserted.
 */

const createSchema = z.object({
  title: z.string().trim().min(1, 'Give it a short name').max(40, 'Keep the name under 40 characters'),
  message: z.string().trim().min(1, 'Write the message').max(4096, 'WhatsApp messages can be up to 4096 characters'),
});
const updateSchema = createSchema.partial().refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

/** "Price list" → "price-list" (what "/" matches). */
function shortcutOf(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return slug || 'reply';
}
const idParam = z.object({ id: z.string().uuid('Invalid quick reply id') });

const router = Router();
router.use(requireAuth);

const select = { id: true, title: true, shortcut: true, message: true, createdAt: true, updatedAt: true } as const;

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    // Oldest first — the order they were added is the order of the buttons.
    res.json(await withTenant(req.auth!.organizationId, (tx) => tx.quickReply.findMany({ orderBy: { createdAt: 'asc' }, select })));
  }),
);

/** Two replies with the same name would be confusing — say so instead of a database error. */
async function assertShortcutFree(organizationId: string, value: string, exceptId?: string) {
  const clash = await withTenant(organizationId, (tx) => tx.quickReply.findFirst({ where: { shortcut: value, ...(exceptId && { id: { not: exceptId } }) }, select: { title: true } }));
  if (clash) throw Conflict(`There's already a quick reply called "${clash.title}" — pick another name`);
}

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.auth!.organizationId;
    const input = req.body as z.infer<typeof createSchema>;
    const shortcut = shortcutOf(input.title);
    await assertShortcutFree(organizationId, shortcut);
    const created = await withTenant(organizationId, (tx) =>
      tx.quickReply.create({ data: { organizationId, ...input, shortcut, createdById: req.auth!.userId }, select }),
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
    const shortcut = input.title ? shortcutOf(input.title) : undefined;
    if (shortcut) await assertShortcutFree(organizationId, shortcut, req.params.id);
    const updated = await withTenant(organizationId, async (tx) => {
      const existing = await tx.quickReply.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!existing) throw NotFound('Quick reply not found');
      return tx.quickReply.update({ where: { id: req.params.id }, data: { ...input, ...(shortcut && { shortcut }) }, select });
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
