import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { systemPrisma, withTenant } from '../../lib/prisma';
import { NotFound } from '../../lib/errors';

/**
 * PUBLIC endpoints — no auth. This is the agency's shareable "host page"
 * (Linktree-style mini site) plus its enquiry form, which files a lead
 * directly into that agency's pipeline.
 *
 * The org lookup by slug uses the privileged client (narrow read of branding
 * fields only); everything tenant-scoped afterwards goes through withTenant,
 * so RLS still governs the actual data reads/writes.
 */

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
});

const slugParam = z.object({ slug: z.string().trim().min(1).max(60) });

const enquirySchema = z
  .object({
    name: z.string().trim().min(1, 'Your name is required').max(120),
    phone: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(40).optional()),
    email: z.preprocess((v) => (v === '' ? undefined : v), z.string().email('Enter a valid email').max(200).optional()),
    destination: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(120).optional()),
    message: z.preprocess((v) => (v === '' ? undefined : v), z.string().max(2000).optional()),
  })
  .refine((o) => o.phone || o.email, { message: 'Add a phone number or email so the agency can reach you', path: ['phone'] });

const router = Router();
router.use(publicLimiter);

/**
 * Public LinkTree payload: the agency's travel package hub.
 * Profile (logo/cover/bio/contacts) + package cards (only packages with
 * "Show on LinkTree" ON) with their upcoming LIVE departure dates.
 */
router.get(
  '/host/:slug',
  validate({ params: slugParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const org = await systemPrisma.organization.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        brandPrimaryColor: true,
        brandSecondaryColor: true,
        bio: true,
        hostLinks: true,
        linktreeCoverUrl: true,
        contactPhone: true,
      },
    });
    if (!org) throw NotFound('This page does not exist');

    const { packages, departuresByPackage } = await withTenant(org.id, async (tx) => {
      const packages = await tx.package.findMany({
        where: { isActive: true, showOnLinktree: true },
        select: {
          id: true,
          name: true,
          destination: true,
          nights: true,
          days: true,
          priceAmount: true,
          priceCurrency: true,
          originalPrice: true,
          description: true,
          bannerImageUrl: true,
          categories: true,
          contactNumber: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const batches = await tx.batch.findMany({
        where: {
          packageId: { in: packages.map((p) => p.id) },
          status: 'LIVE',
          departureDate: { gte: today },
        },
        select: { packageId: true, departureDate: true },
        orderBy: { departureDate: 'asc' },
      });
      const departuresByPackage: Record<string, string[]> = {};
      for (const b of batches) {
        (departuresByPackage[b.packageId] ??= []).push(b.departureDate.toISOString());
      }
      return { packages, departuresByPackage };
    });

    // WhatsApp/Call number: the org's contact phone, else first package that has one.
    const rawPhone = org.contactPhone ?? packages.find((p) => p.contactNumber)?.contactNumber ?? null;
    const contactNumber = rawPhone ? rawPhone.replace(/\D/g, '') : null;

    // Instagram from the org's links, if present.
    const links = (org.hostLinks as Array<{ label: string; url: string }> | null) ?? [];
    const instagramUrl = links.find((l) => /instagram\.com/i.test(l.url))?.url ?? null;

    const { id: _id, contactPhone: _cp, ...publicOrg } = org;
    res.json({
      ...publicOrg,
      contactNumber,
      instagramUrl,
      websiteUrl: `/site/${org.slug}`,
      packages: packages.map(({ contactNumber: _c, ...p }) => ({
        ...p,
        departures: (departuresByPackage[p.id] ?? []).slice(0, 4),
      })),
    });
  }),
);

/**
 * PUBLIC package brochure by id — the shareable link. The UUID is the unguessable
 * token (unlisted share). Returns the full package plus the owning agency's
 * branding so the brochure renders without a login.
 */
const packageIdParam = z.object({ id: z.string().uuid('Invalid package id') });

router.get(
  '/package/:id',
  validate({ params: packageIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const pkg = await systemPrisma.package.findUnique({ where: { id: req.params.id } });
    if (!pkg) throw NotFound('This package does not exist');

    const org = await systemPrisma.organization.findUnique({
      where: { id: pkg.organizationId },
      select: {
        name: true,
        slug: true,
        logoUrl: true,
        brandPrimaryColor: true,
        brandSecondaryColor: true,
      },
    });

    const { organizationId: _orgId, ...publicPkg } = pkg;
    res.json({ package: publicPkg, organization: org });
  }),
);

/**
 * Public LinkTree payload: /public/linktree/:slug — the LinkTree module's own
 * endpoint (independent of the host/site payloads).
 *
 * SECURITY: the organization is resolved from the slug (no session). Everything
 * tenant-scoped below runs through withTenant(org.id), so RLS confines every
 * query to that one organization — categories, joins, packages, departures.
 */
router.get(
  '/linktree/:slug',
  validate({ params: slugParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const org = await systemPrisma.organization.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        brandPrimaryColor: true,
        linktreeTheme: true,
      },
    });
    if (!org) throw NotFound('This page does not exist');

    const data = await withTenant(org.id, async (tx) => {
      const packages = await tx.package.findMany({
        where: { showOnLinktree: true },
        select: {
          id: true,
          name: true,
          destination: true,
          nights: true,
          days: true,
          priceAmount: true,
          priceCurrency: true,
          originalPrice: true,
          bannerImageUrl: true,
          linktreeCategoryLinks: { select: { linktreeCategoryId: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const batches = await tx.batch.findMany({
        where: {
          packageId: { in: packages.map((p) => p.id) },
          status: 'LIVE',
          departureDate: { gte: today },
        },
        select: { packageId: true, departureDate: true },
        orderBy: { departureDate: 'asc' },
      });
      const departuresByPackage: Record<string, string[]> = {};
      for (const b of batches) {
        (departuresByPackage[b.packageId] ??= []).push(b.departureDate.toISOString());
      }

      // Tabs: only categories that contain at least one visible package, in the
      // agency's sort order. Never hardcoded — recomputed on every load.
      const visibleCategoryIds = new Set(packages.flatMap((p) => p.linktreeCategoryLinks.map((pc) => pc.linktreeCategoryId)));
      const categories = (
        await tx.linktreeCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
      )
        .filter((c) => visibleCategoryIds.has(c.id))
        .map((c) => ({ id: c.id, name: c.name }));

      return {
        categories,
        packages: packages.map(({ linktreeCategoryLinks, ...p }) => ({
          ...p,
          linktreeCategoryIds: linktreeCategoryLinks.map((pc) => pc.linktreeCategoryId),
          departures: (departuresByPackage[p.id] ?? []).slice(0, 4),
        })),
      };
    });

    const { id: _id, ...publicOrg } = org;
    res.json({ organization: publicOrg, ...data });
  }),
);

/**
 * Public Host Page mini-website payload: /public/site/:slug
 * A premium single-page marketing site: agency brand + ALL its packages +
 * reviews. Reuses the org's existing profile fields (logo, cover, bio, phone,
 * email, Instagram from links). NOTE: unlike LinkTree, there is NO per-package
 * toggle — every package for this org is returned.
 */
router.get(
  '/site/:slug',
  validate({ params: slugParam }),
  asyncHandler(async (req: Request, res: Response) => {
    const org = await systemPrisma.organization.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        brandPrimaryColor: true,
        brandSecondaryColor: true,
        bio: true,
        hostLinks: true,
        bannerImageUrl: true,
        aboutText: true,
        contactPhone: true,
        contactEmail: true,
        address: true,
      },
    });
    if (!org) throw NotFound('This page does not exist');

    const { packages, reviews } = await withTenant(org.id, async (tx) => {
      // Every active package for this org — no visibility toggle for Host Page.
      const packages = await tx.package.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          destination: true,
          nights: true,
          days: true,
          priceAmount: true,
          priceCurrency: true,
          originalPrice: true,
          bannerImageUrl: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 60,
      });

      const reviews = await tx.hostReview.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, reviewerName: true, photoUrl: true, quote: true, rating: true },
      });

      return { packages, reviews };
    });

    // Instagram + WhatsApp from the org's existing profile fields.
    const links = (org.hostLinks as Array<{ label: string; url: string }> | null) ?? [];
    const instagramUrl = links.find((l) => /instagram\.com/i.test(l.url))?.url ?? null;
    const whatsappNumber = org.contactPhone ? org.contactPhone.replace(/\D/g, '') || null : null;

    const { id: _id, hostLinks: _hl, ...publicOrg } = org;
    res.json({ organization: { ...publicOrg, instagramUrl, whatsappNumber }, packages, reviews });
  }),
);

/** Public enquiry form → creates a WEBSITE lead in that agency's pipeline. */
router.post(
  '/host/:slug/enquiry',
  validate({ params: slugParam, body: enquirySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const org = await systemPrisma.organization.findUnique({
      where: { slug: req.params.slug },
      select: { id: true },
    });
    if (!org) throw NotFound('This page does not exist');

    await withTenant(org.id, (tx) =>
      tx.lead.create({
        data: {
          organizationId: org.id,
          name: req.body.name,
          phone: req.body.phone ?? null,
          email: req.body.email ?? null,
          destination: req.body.destination ?? null,
          notes: req.body.message ?? null,
          source: 'WEBSITE',
          status: 'NEW',
        },
      }),
    );

    res.status(201).json({ ok: true, message: 'Thanks! The team will get back to you shortly.' });
  }),
);

export default router;
