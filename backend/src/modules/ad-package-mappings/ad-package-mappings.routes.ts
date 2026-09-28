import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { withTenant } from '../../lib/prisma';
import { AppError, BadRequest, NotFound } from '../../lib/errors';

// Ad → Package links: when a traveller messages from a Click-to-WhatsApp ad
// whose id is linked here, that package is sent to them automatically (see
// sendAdPackageIfMapped in webhooks.service.ts and the session-start path in
// bot-flow.engine.ts).

// Meta ad ids are long numeric strings; accept pasted whitespace.
const adIdSchema = z.string().trim().regex(/^\d{6,30}$/, 'Ad ID should be the numeric ID from Meta Ads Manager');

const createSchema = z.object({
  adId: adIdSchema,
  packageId: z.string().uuid('Choose a package'),
});

const updateSchema = z.object({ packageId: z.string().uuid('Choose a package') });

const idParam = z.object({ id: z.string().uuid('Invalid link id') });

const packageSelect = { package: { select: { id: true, name: true, destination: true, isActive: true } } } satisfies Prisma.AdPackageMappingInclude;

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.auth!.organizationId;
    const rows = await withTenant(organizationId, (tx) =>
      tx.adPackageMapping.findMany({ where: { organizationId }, include: packageSelect, orderBy: { createdAt: 'desc' } }),
    );
    res.json(rows);
  }),
);

router.post(
  '/',
  requireRole('ADMIN'),
  validate({ body: createSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.auth!.organizationId;
    const { adId, packageId } = req.body as z.infer<typeof createSchema>;
    const row = await withTenant(organizationId, async (tx) => {
      const pkg = await tx.package.findUnique({ where: { id: packageId } });
      if (!pkg) throw BadRequest('Selected package was not found in your organization');
      const existing = await tx.adPackageMapping.findUnique({
        where: { organizationId_adId: { organizationId, adId } },
        include: packageSelect,
      });
      if (existing) throw new AppError(409, 'CONFLICT', `This ad is already linked to "${existing.package.name}" — edit that link instead`);
      return tx.adPackageMapping.create({ data: { organizationId, adId, packageId }, include: packageSelect });
    });
    res.status(201).json(row);
  }),
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: idParam, body: updateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.auth!.organizationId;
    const { packageId } = req.body as z.infer<typeof updateSchema>;
    const row = await withTenant(organizationId, async (tx) => {
      const pkg = await tx.package.findUnique({ where: { id: packageId } });
      if (!pkg) throw BadRequest('Selected package was not found in your organization');
      const found = await tx.adPackageMapping.findUnique({ where: { id: req.params.id } });
      if (!found) throw NotFound('Ad link not found');
      return tx.adPackageMapping.update({ where: { id: req.params.id }, data: { packageId }, include: packageSelect });
    });
    res.json(row);
  }),
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  validate({ params: idParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.auth!.organizationId;
    await withTenant(organizationId, async (tx) => {
      const result = await tx.adPackageMapping.deleteMany({ where: { id: req.params.id, organizationId } });
      if (result.count === 0) throw NotFound('Ad link not found');
    });
    res.json({ ok: true });
  }),
);

export default router;
