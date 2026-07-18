import { z } from 'zod';

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
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'No fields to update' });

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
