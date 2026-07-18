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

/** Public host page payload: branding + links + active packages. */
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
      },
    });
    if (!org) throw NotFound('This page does not exist');

    const packages = await withTenant(org.id, (tx) =>
      tx.package.findMany({
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
          description: true,
          bannerImageUrl: true,
          categories: true,
          contactNumber: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 24,
      }),
    );

    // A WhatsApp number for the whole page: first package that has one (digits only).
    const rawPhone = packages.find((p) => p.contactNumber)?.contactNumber ?? null;
    const contactNumber = rawPhone ? rawPhone.replace(/\D/g, '') : null;

    const { id: _id, ...publicOrg } = org;
    res.json({ ...publicOrg, contactNumber, packages: packages.map(({ contactNumber: _c, ...p }) => p) });
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
