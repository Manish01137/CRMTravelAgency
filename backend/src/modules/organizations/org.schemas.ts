import { z } from 'zod';

/**
 * A link as people actually type it → a full https:// link.
 * "www.agency.in" / "agency.in/trips" → "https://…"; for Instagram also
 * "@agency" or "agency" → "https://instagram.com/agency". "" → null.
 */
function looseUrl(v: unknown, kind?: 'instagram'): unknown {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (kind === 'instagram' && /^@?[\w.]{1,30}$/.test(t) && !t.includes('.com')) return `https://instagram.com/${t.replace(/^@/, '')}`;
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(t.replace(/^\/\//, ''))) return `https://${t.replace(/^\/\//, '')}`;
  return t;
}

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, 'Use a 6-digit hex color like #4F46E5');

export const updateOrgSchema = z
  .object({
    name: z.string().trim().min(2, 'Agency name is too short').max(80).optional(),
    logoUrl: z
      .preprocess(
        (v) => (v === '' ? null : v),
        z.string().url('Enter a valid URL').max(2000).nullable(),
      )
      .optional(),
    brandPrimaryColor: hexColor.optional(),
    brandSecondaryColor: hexColor.optional(),
    bio: z
      .preprocess((v) => (v === '' ? null : v), z.string().max(500).nullable())
      .optional(),
    hostLinks: z
      .array(
        z.object({
          label: z.string().trim().min(1, 'Label required').max(60),
          url: z.string().trim().url('Enter a valid URL').max(500),
        }),
      )
      .max(10)
      .optional(),
    // Host Page mini-website
    bannerImageUrl: z
      .preprocess((v) => (v === '' ? null : v), z.string().url('Enter a valid URL').max(2000).nullable())
      .optional(),
    aboutText: z.preprocess((v) => (v === '' ? null : v), z.string().max(5000).nullable()).optional(),
    contactPhone: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(40).nullable()).optional(),
    contactEmail: z
      .preprocess((v) => (v === '' ? null : v), z.string().email('Enter a valid email').max(200).nullable())
      .optional(),
    address: z.preprocess((v) => (v === '' ? null : v), z.string().max(300).nullable()).optional(),
    // LinkTree (public package hub) cover image
    linktreeCoverUrl: z
      .preprocess((v) => (v === '' ? null : v), z.string().url('Enter a valid URL').max(2000).nullable())
      .optional(),
    // Host Page gallery (image URLs)
    hostGallery: z.array(z.string().url().max(2000)).max(60).optional(),
    // Default policy text, auto-filled into a NEW package's Policies step.
    defaultCancellationPolicy: z.preprocess((v) => (v === '' ? null : v), z.string().max(5000).nullable()).optional(),
    defaultPaymentTerms: z.preprocess((v) => (v === '' ? null : v), z.string().max(5000).nullable()).optional(),
    defaultTermsConditions: z.preprocess((v) => (v === '' ? null : v), z.string().max(5000).nullable()).optional(),
    // Tax invoice details — printed on the invoice header/footer (see PROJECT
    // notes). All optional: a blank field just doesn't render on the invoice.
    secondaryPhone: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(40).nullable()).optional(),
    secondaryEmail: z.preprocess((v) => (v === '' ? null : v), z.string().email('Enter a valid email').max(200).nullable()).optional(),
    stateName: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(80).nullable()).optional(),
    stateCode: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(10).nullable()).optional(),
    bankName: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(120).nullable()).optional(),
    bankAccountNumber: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(40).nullable()).optional(),
    ifscCode: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(20).nullable()).optional(),
    gstin: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(20).nullable()).optional(),
    pan: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(15).nullable()).optional(),
    hsnCode: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(20).nullable()).optional(),
    signatureImageUrl: z
      .preprocess((v) => (v === '' ? null : v), z.string().url('Enter a valid URL').max(2000).nullable())
      .optional(),
    signatoryTitle: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(80).nullable()).optional(),
    invoiceTermsConditions: z.preprocess((v) => (v === '' ? null : v), z.string().max(5000).nullable()).optional(),
    // LinkTree module theme (its own object, independent of Host Page branding)
    linktreeTheme: z
      .object({
        logoUrl: z.preprocess((v) => (v === '' ? null : v), z.string().url().max(2000).nullable()).optional(),
        agencyName: z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(120).nullable()).optional(),
        shortBio: z.preprocess((v) => (v === '' ? null : v), z.string().max(500, 'Keep the bio under 500 characters').nullable()).optional(),
        // People type "instagram.com/agency", "@agency" or "www.agency.in" — turned into full links.
        instagramUrl: z.preprocess((v) => looseUrl(v, 'instagram'), z.string().url('Enter your Instagram link, e.g. instagram.com/youragency').max(500).nullable()).optional(),
        whatsappNumber: z.preprocess(
          // "+91 98765 43210" → "+919876543210"; text without any digits stays as typed, so it's flagged.
          (v) => (typeof v === 'string' ? (v.trim() ? v.replace(/[^\d+]/g, '') || v.trim() : null) : v),
          z.string().regex(/^\+?\d{8,15}$/, 'Enter the WhatsApp number with country code, e.g. 919876543210').nullable(),
        ).optional(),
        websiteUrl: z.preprocess((v) => looseUrl(v), z.string().url('Enter your website, e.g. www.youragency.com').max(500).nullable()).optional(),
        buttonColor: z
          .preprocess((v) => (v === '' ? null : v), z.string().regex(/^#([0-9a-fA-F]{6})$/).nullable())
          .optional(),
        fontChoice: z.enum(['figtree', 'playfair', 'grotesk', 'lora', 'bebas']).optional(),
        backgroundType: z.enum(['color', 'image', 'video']).optional(),
        backgroundColor: z
          .preprocess((v) => (v === '' ? null : v), z.string().regex(/^#([0-9a-fA-F]{6})$/).nullable())
          .optional(),
        backgroundImageUrl: z.preprocess((v) => (v === '' ? null : v), z.string().url().max(2000).nullable()).optional(),
        backgroundVideoUrl: z.preprocess((v) => (v === '' ? null : v), z.string().url().max(2000).nullable()).optional(),
        allowVideoOnMobile: z.boolean().optional(),
      })
      .optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'No fields to update' });

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
