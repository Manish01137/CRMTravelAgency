import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const emptyToNull = (v: unknown) => (v === '' ? null : v);

const optText = (max = 5000) => z.preprocess(emptyToUndefined, z.string().max(max).optional());
const nullText = (max = 5000) => z.preprocess(emptyToNull, z.string().max(max).nullable()).optional();
const optUrl = z.preprocess(emptyToUndefined, z.string().url('Enter a valid URL').max(2000).optional());
const nullUrl = z.preprocess(emptyToNull, z.string().url('Enter a valid URL').max(2000).nullable()).optional();

// --- Repeatable structured blocks (stored as JSON) ---------------------------
const pricingOptionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  price: z.coerce.number().int().nonnegative().max(1_000_000_000),
});
const itineraryDaySchema = z.object({
  day: z.coerce.number().int().min(1).max(366),
  title: z.string().trim().min(1).max(200),
  description: z.preprocess(emptyToUndefined, z.string().max(5000).optional()),
  // Day-wise logistics for the detailed PDF: where the group stays + what they do.
  hotelId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  stay: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  activities: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  meals: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  images: z.array(z.string().url().max(2000)).max(6).optional(), // photo collage on the day's PDF page
  // Activity blocks pulled from the Sightseeing library — INDEPENDENT COPIES.
  // Editing these here never writes back to the Sightseeing entry.
  activityBlocks: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        description: z.preprocess(emptyToUndefined, z.string().max(5000).optional()),
        imageUrl: z.preprocess(emptyToUndefined, z.string().url().max(2000).optional()),
      }),
    )
    .max(20)
    .optional(),
});
const faqSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(3000),
});
const categoriesSchema = z.array(z.string().trim().min(1).max(60)).max(20);
const highlightsSchema = z.array(z.string().trim().min(1).max(200)).max(30);
const gallerySchema = z.array(z.string().url().max(2000)).max(30);

// Public page design themes. The first three are the originals; the rest are
// the premium per-template identities (each has its own palette/font/layout).
const PDF_TEMPLATES = ['alpine', 'heritage', 'beach', 'corporate', 'vibrant'] as const;

const VIEW_TYPES = [
  'CLASSIC',
  'MODERN',
  'MINIMAL',
  'ADVENTURE',
  'BEACH',
  'PILGRIMAGE',
  'ROMANCE',
  'WILDLIFE',
  'WEEKEND',
  'LUXURY',
  'BACKPACK',
  'FAMILY',
  'HILLS',
] as const;

// Shared shape used by create + update (create makes core fields required).
const builderFields = {
  code: optText(60),
  slug: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .trim()
      .toLowerCase()
      .max(80)
      .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only')
      .optional(),
  ),
  viewType: z.enum(VIEW_TYPES).default('CLASSIC'),
  categories: categoriesSchema.default([]),
  bookingTitle: optText(200),
  originalPrice: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().max(1_000_000_000).optional()),
  pricingOptions: z.array(pricingOptionSchema).max(20).default([]),
  bannerImageUrl: optUrl,
  whatsappBannerUrl: optUrl,
  whatsappDescription: optText(2000),
  contactNumber: optText(40),
  contactEmail: z.preprocess(emptyToUndefined, z.string().email('Enter a valid email').max(200).optional()),
  itinerary: z.array(itineraryDaySchema).max(200).default([]),
  thingsToCarry: optText(3000),
  pickupPoints: optText(3000),
  cancellationPolicy: optText(5000),
  paymentTerms: optText(5000),
  termsConditions: optText(5000),
  faqs: z.array(faqSchema).max(50).default([]),
  highlights: highlightsSchema.default([]),
  galleryImages: gallerySchema.default([]),
};

export const createPackageSchema = z.object({
  name: z.string().trim().min(1, 'Package name is required').max(150),
  destination: z.string().trim().min(1, 'Destination is required').max(120),
  nights: z.coerce.number().int().min(0).max(365).default(1),
  days: z.coerce.number().int().min(1).max(366).default(2),
  priceAmount: z.coerce.number().int().nonnegative().max(1_000_000_000),
  priceCurrency: z.string().trim().length(3).toUpperCase().default('INR'),
  description: optText(20000),
  inclusions: optText(5000),
  exclusions: optText(5000),
  isActive: z.coerce.boolean().default(true),
  showOnLinktree: z.coerce.boolean().default(false),
  showOnHostpage: z.coerce.boolean().default(false),
  pdfTemplateId: z.enum(PDF_TEMPLATES).default('alpine'),
  linktreeCategoryIds: z.array(z.string().uuid()).max(50).optional(),
  ...builderFields,
});

export const updatePackageSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    destination: z.string().trim().min(1).max(120).optional(),
    nights: z.coerce.number().int().min(0).max(365).optional(),
    days: z.coerce.number().int().min(1).max(366).optional(),
    priceAmount: z.coerce.number().int().nonnegative().max(1_000_000_000).optional(),
    priceCurrency: z.string().trim().length(3).toUpperCase().optional(),
    description: nullText(20000),
    inclusions: nullText(5000),
    exclusions: nullText(5000),
    isActive: z.coerce.boolean().optional(),
    showOnLinktree: z.coerce.boolean().optional(),
    showOnHostpage: z.coerce.boolean().optional(),
    pdfTemplateId: z.enum(PDF_TEMPLATES).optional(),
    linktreeCategoryIds: z.array(z.string().uuid()).max(50).optional(),

    code: nullText(60),
    slug: z.preprocess(
      emptyToNull,
      z.string().trim().toLowerCase().max(80).regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only').nullable(),
    ).optional(),
    viewType: z.enum(VIEW_TYPES).optional(),
    categories: categoriesSchema.optional(),
    bookingTitle: nullText(200),
    originalPrice: z.preprocess(emptyToNull, z.coerce.number().int().nonnegative().max(1_000_000_000).nullable()).optional(),
    pricingOptions: z.array(pricingOptionSchema).max(20).optional(),
    bannerImageUrl: nullUrl,
    whatsappBannerUrl: nullUrl,
    whatsappDescription: nullText(2000),
    contactNumber: nullText(40),
    contactEmail: z.preprocess(emptyToNull, z.string().email().max(200).nullable()).optional(),
    itinerary: z.array(itineraryDaySchema).max(200).optional(),
    thingsToCarry: nullText(3000),
    pickupPoints: nullText(3000),
    cancellationPolicy: nullText(5000),
    paymentTerms: nullText(5000),
    termsConditions: nullText(5000),
    faqs: z.array(faqSchema).max(50).optional(),
    highlights: highlightsSchema.optional(),
    galleryImages: gallerySchema.optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

export const listPackagesQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  active: z.enum(['true', 'false']).optional(),
});

export const packageIdParam = z.object({ id: z.string().uuid('Invalid package id') });

export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
export type ListPackagesQuery = z.infer<typeof listPackagesQuerySchema>;
