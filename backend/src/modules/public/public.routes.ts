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
          description: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
    );

    const { id: _id, ...publicOrg } = org;
    res.json({ ...publicOrg, packages });
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
