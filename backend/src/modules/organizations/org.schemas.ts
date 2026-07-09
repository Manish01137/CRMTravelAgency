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
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'No fields to update' });

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;
