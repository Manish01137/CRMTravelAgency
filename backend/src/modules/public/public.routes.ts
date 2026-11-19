import { Router } from 'express';
import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { systemPrisma, withTenant } from '../../lib/prisma';
import { NotFound } from '../../lib/errors';
import { findRepeatCustomerBooking } from '../../lib/leadBookingLinking';
import { fetchImageForExport, ImageProxyError } from '../../lib/imageProxy';

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
        hostLinks: true,
        contactPhone: true,
        contactEmail: true,
        secondaryPhone: true,
        address: true,
        // Same bank details already printed on invoices (Organization's tax-invoice
        // fields) — reused here so the PDF brochure's payment section can show a
        // real bank transfer option instead of a fabricated one. All optional:
        // the payment box simply doesn't render when these are unset.
        bankName: true,
        bankAccountNumber: true,
        ifscCode: true,
      },
    });

    // Instagram from the org's existing links (same derivation as LinkTree/Host Page).
    const links = (org?.hostLinks as Array<{ label: string; url: string }> | null) ?? [];
    const instagramUrl = links.find((l) => /instagram\.com/i.test(l.url))?.url ?? null;
    // WhatsApp number: same fallback chain as the Host Page (org contact, else the package's own).
    const rawWhatsapp = org?.contactPhone ?? pkg.contactNumber ?? null;
    const whatsappNumber = rawWhatsapp ? rawWhatsapp.replace(/\D/g, '') || null : null;
    const { hostLinks: _hl, contactPhone: _cp, ...publicOrg } = org ?? {};
    // Social / website links (the Adventure brochure's icon row and contact page).
    const socialLinks = links.filter((l) => /^https?:\/\//i.test(l.url)).slice(0, 8).map((l) => ({ label: l.label, url: l.url }));
    const phones = [org?.contactPhone, org?.secondaryPhone].filter((p): p is string => !!p?.trim());

    // Customer reviews for the brochure's "Reviews" page — org-wide testimonials
    // (same source as the Host Page), not package-specific; there's no
    // per-package review model. Capped at 6 to match the brochure's fixed grid.
    const { reviews, departures } = await withTenant(pkg.organizationId, async (tx) => {
      const reviews = await tx.hostReview.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        take: 6,
        select: { id: true, reviewerName: true, photoUrl: true, quote: true, rating: true },
      });
      // Upcoming live departures of this package — the Adventure brochure's batch dates.
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const batches = await tx.batch.findMany({
        where: { packageId: pkg.id, status: 'LIVE', departureDate: { gte: today } },
        orderBy: { departureDate: 'asc' },
        take: 52,
        select: { id: true, departureDate: true, returnDate: true, capacity: true },
      });
      const booked = batches.length
        ? await tx.booking.groupBy({
            by: ['batchId'],
            where: { batchId: { in: batches.map((b) => b.id) }, status: { not: 'CANCELLED' } },
            _sum: { travelerCount: true },
            _count: { _all: true },
          })
        : [];
      const departures = batches.map((b) => ({
        departureDate: b.departureDate.toISOString().slice(0, 10),
        returnDate: b.returnDate?.toISOString().slice(0, 10) ?? null,
        // Seats taken: travellers on its bookings (a booking without a count is one seat).
        full: (() => {
          const g = booked.find((x) => x.batchId === b.id);
          return Math.max(g?._sum.travelerCount ?? 0, g?._count._all ?? 0) >= b.capacity;
        })(),
      }));
      return { reviews, departures };
    });

    const { organizationId: _orgId, ...publicPkg } = pkg;
    res.json({
      package: publicPkg,
      organization: org ? { ...publicOrg, instagramUrl, whatsappNumber, socialLinks, phones } : null,
      reviews,
      departures,
    });
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

    await withTenant(org.id, async (tx) => {
      const repeatBooking = await findRepeatCustomerBooking(tx, org.id, req.body.phone ?? null, req.body.email ?? null);
      return tx.lead.create({
        data: {
          organizationId: org.id,
          name: req.body.name,
          phone: req.body.phone ?? null,
          email: req.body.email ?? null,
          destination: req.body.destination ?? null,
          notes: req.body.message ?? null,
          source: 'WEBSITE',
          status: 'NEW',
          isRepeatCustomer: !!repeatBooking,
          repeatBookingId: repeatBooking?.id,
        },
      });
    });

    res.status(201).json({ ok: true, message: 'Thanks! The team will get back to you shortly.' });
  }),
);

/**
 * LinkTree "Book this trip" → a WEBSITE lead for that trip (it shows in Leads
 * with the package as the interested package). Phone is required; a repeat
 * tap by the same person on the same trip within 30 minutes doesn't make a
 * second lead. `website` is a honeypot — bots fill it, people never see it.
 */
const linktreeEnquiryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests — please try again in a few minutes' } },
});
const linktreeEnquirySchema = z.object({
  packageId: z.string().uuid('Pick a trip'),
  name: z.string().trim().min(1, 'Your name is required').max(120),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v.replace(/\D/g, '').length >= 7 && v.replace(/\D/g, '').length <= 15, 'Enter a valid phone number'),
  email: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().email('Enter a valid email').max(200).optional()),
  website: z.string().max(200).optional(),
  /** "book" (BOOK button) or "pdf" (asked for the brochure first). */
  intent: z.enum(['book', 'pdf']).default('book'),
});

type TripEnquiry = z.infer<typeof linktreeEnquirySchema>;

/**
 * Files the lead for a trip enquiry (BOOK, or a brochure request). Skips bots
 * (honeypot) and repeats: same phone + same trip within 30 minutes.
 */
async function createTripLead(organizationId: string, body: TripEnquiry, where: string, pkgWhere: Prisma.PackageWhereInput) {
  if (body.website) return; // a bot — pretend it worked, file nothing
  await withTenant(organizationId, async (tx) => {
    const pkg = await tx.package.findFirst({
      where: { id: body.packageId, ...pkgWhere },
      select: { id: true, name: true, destination: true, nights: true, days: true },
    });
    if (!pkg) throw NotFound('This trip is no longer available');
    const phone = body.phone.trim();
    const digits = phone.replace(/\D/g, '');
    // Compared by digits only: "+91 98765 11122" and "9876511122" are the same person.
    const recent = await tx.lead.findMany({
      where: { packageId: pkg.id, createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, phone: { not: null } },
      select: { phone: true },
      take: 200,
    });
    if (recent.some((l) => (l.phone ?? '').replace(/\D/g, '').slice(-10) === digits.slice(-10))) return;
    const repeatBooking = await findRepeatCustomerBooking(tx, organizationId, phone, body.email ?? null);
    await tx.lead.create({
      data: {
        organizationId,
        name: body.name,
        phone,
        email: body.email ?? null,
        destination: pkg.destination,
        packageId: pkg.id,
        notes: `${body.intent === 'pdf' ? 'Downloaded the brochure (PDF)' : 'Booking enquiry'} from ${where} — ${pkg.name} (${pkg.days}D/${pkg.nights}N)`,
        source: 'WEBSITE',
        status: 'NEW',
        isRepeatCustomer: !!repeatBooking,
        repeatBookingId: repeatBooking?.id,
      },
    });
  });
}

const enquiryThanks = { ok: true, message: 'Thank you! Our team will call you shortly.' };

router.post(
  '/linktree/:slug/enquiry',
  linktreeEnquiryLimiter,
  validate({ params: slugParam, body: linktreeEnquirySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as TripEnquiry;
    if (!body.website) {
      const org = await systemPrisma.organization.findUnique({ where: { slug: req.params.slug }, select: { id: true } });
      if (!org) throw NotFound('This page does not exist');
      await createTripLead(org.id, body, 'LinkTree', { isActive: true, showOnLinktree: true });
    }
    res.status(201).json(enquiryThanks);
  }),
);

/** The trip page's (/p/:id) "PDF" form — the package id is the trip; the agency comes from it. */
router.post(
  '/package/:id/enquiry',
  linktreeEnquiryLimiter,
  validate({ params: packageIdParam, body: linktreeEnquirySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as TripEnquiry;
    if (!body.website) {
      if (body.packageId !== req.params.id) throw NotFound('This trip is no longer available');
      const pkg = await systemPrisma.package.findUnique({ where: { id: req.params.id }, select: { organizationId: true } });
      if (!pkg) throw NotFound('This trip is no longer available');
      await createTripLead(pkg.organizationId, body, 'the trip page', {});
    }
    res.status(201).json(enquiryThanks);
  }),
);

// Brochure PDF export (html2canvas `proxy` option): re-serves a remote image
// same-origin so logos/photos from hosts without CORS headers still render in
// the PDF. See lib/imageProxy.ts for the SSRF safeguards.
const imageProxyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many image requests, please try again shortly' } },
});

router.get(
  '/image-proxy',
  imageProxyLimiter,
  validate({ query: z.object({ url: z.string().min(1).max(2000), responseType: z.string().optional() }) }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const image = await fetchImageForExport(String(req.query.url));
      res.setHeader('Content-Type', image.contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // An SVG opened directly on our origin could run script — never let it.
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
      res.send(image.body);
    } catch (err) {
      if (err instanceof ImageProxyError) {
        res.status(err.status).json({ error: { code: 'IMAGE_PROXY', message: err.message } });
        return;
      }
      throw err;
    }
  }),
);

export default router;
