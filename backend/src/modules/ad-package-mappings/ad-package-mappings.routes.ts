import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { withTenant, type TenantTx } from '../../lib/prisma';
import { AppError, BadRequest, NotFound } from '../../lib/errors';
import { MAX_PACKAGES_PER_AD, findAdPackages } from './ad-package-mappings.service';

// Ads → Packages: a traveller who messages from a linked Click-to-WhatsApp ad
// is sent that ad's packages automatically (see sendAdPackagesIfNotFlowHandled
// in webhooks.service.ts and the session-start path in bot-flow.engine.ts).
// Stored as one row per (ad, package); the API works per ad.

// Meta ad ids are long numeric strings; accept pasted whitespace.
const adIdSchema = z.string().trim().regex(/^\d{6,30}$/, 'Ad ID should be the numeric ID from Meta Ads Manager');
const packageIdsSchema = z
  .array(z.string().uuid())
  .min(1, 'Choose at least one package')
  .max(MAX_PACKAGES_PER_AD, `Up to ${MAX_PACKAGES_PER_AD} packages per ad`)
  .transform((ids) => [...new Set(ids)]);

const createSchema = z.object({ adId: adIdSchema, packageIds: packageIdsSchema });
const updateSchema = z.object({ packageIds: packageIdsSchema });
const adIdParam = z.object({ adId: adIdSchema });

async function assertPackagesInOrg(tx: TenantTx, packageIds: string[]) {
  const found = await tx.package.count({ where: { id: { in: packageIds } } }); // RLS-scoped to this org
  if (found !== packageIds.length) throw BadRequest('A selected package was not found in your organization');
}

async function replacePackages(tx: TenantTx, organizationId: string, adId: string, packageIds: string[]) {
  await tx.adPackageMapping.deleteMany({ where: { organizationId, adId, packageId: { notIn: packageIds } } });
  await tx.adPackageMapping.createMany({
    data: packageIds.map((packageId) => ({ organizationId, adId, packageId })),
    skipDuplicates: true,
  });
  // Until the ad_multi_package migration runs, the old one-package-per-ad
  // unique index makes skipDuplicates silently drop the extras — refuse
  // (rolling the whole change back) rather than report a partial save.
  const saved = await tx.adPackageMapping.count({ where: { organizationId, adId } });
  if (saved !== packageIds.length) {
    throw new AppError(409, 'MIGRATION_PENDING', "Several packages per ad needs a server update that hasn't been applied yet — link one package for now.");
  }
}

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.auth!.organizationId;
    const rows = await withTenant(organizationId, (tx) =>
      tx.adPackageMapping.findMany({
        where: { organizationId },
        include: { package: { select: { id: true, name: true, destination: true, isActive: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    );
    // Group rows into one entry per ad (newest ad first), packages alphabetical — same order they're sent in.
    const byAd = new Map<string, { adId: string; createdAt: Date; packages: (typeof rows)[number]['package'][] }>();
    for (const r of rows) {
      const ad = byAd.get(r.adId) ?? { adId: r.adId, createdAt: r.createdAt, packages: [] };
      ad.packages.push(r.package);
      byAd.set(r.adId, ad);
    }
    const ads = [...byAd.values()].map((ad) => ({ ...ad, packages: ad.packages.sort((a, b) => a.name.localeCompare(b.name)) }));
    res.json(ads);
  }),
);

router.post(
  '/',
  requireRole('ADMIN'),
  validate({ body: createSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.auth!.organizationId;
    const { adId, packageIds } = req.body as z.infer<typeof createSchema>;
    const ad = await withTenant(organizationId, async (tx) => {
      await assertPackagesInOrg(tx, packageIds);
      const existing = await tx.adPackageMapping.count({ where: { organizationId, adId } });
      if (existing > 0) throw new AppError(409, 'CONFLICT', 'This ad is already linked — edit it in the list below instead');
      await replacePackages(tx, organizationId, adId, packageIds);
      return { adId, packages: await findAdPackages(tx, organizationId, adId) };
    });
    res.status(201).json(ad);
  }),
);

router.put(
  '/:adId',
  requireRole('ADMIN'),
  validate({ params: adIdParam, body: updateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.auth!.organizationId;
    const { adId } = req.params as z.infer<typeof adIdParam>;
    const { packageIds } = req.body as z.infer<typeof updateSchema>;
    const ad = await withTenant(organizationId, async (tx) => {
      const existing = await tx.adPackageMapping.count({ where: { organizationId, adId } });
      if (existing === 0) throw NotFound('Ad link not found');
      await assertPackagesInOrg(tx, packageIds);
      await replacePackages(tx, organizationId, adId, packageIds);
      return { adId, packages: await findAdPackages(tx, organizationId, adId) };
    });
    res.json(ad);
  }),
);

router.delete(
  '/:adId',
  requireRole('ADMIN'),
  validate({ params: adIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = req.auth!.organizationId;
    const { adId } = req.params as z.infer<typeof adIdParam>;
    await withTenant(organizationId, async (tx) => {
      const result = await tx.adPackageMapping.deleteMany({ where: { organizationId, adId } });
      if (result.count === 0) throw NotFound('Ad link not found');
    });
    res.json({ ok: true });
  }),
);

export default router;
