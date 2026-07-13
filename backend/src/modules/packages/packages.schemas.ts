import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const emptyToNull = (v: unknown) => (v === '' ? null : v);

export const createPackageSchema = z.object({
  name: z.string().trim().min(1, 'Package name is required').max(120),
  destination: z.string().trim().min(1, 'Destination is required').max(120),
  nights: z.coerce.number().int().min(0).max(365).default(1),
  days: z.coerce.number().int().min(1).max(366).default(2),
  priceAmount: z.coerce.number().int().nonnegative().max(1_000_000_000),
  priceCurrency: z.string().trim().length(3).toUpperCase().default('INR'),
  description: z.preprocess(emptyToUndefined, z.string().max(5000).optional()),
  inclusions: z.preprocess(emptyToUndefined, z.string().max(5000).optional()),
  exclusions: z.preprocess(emptyToUndefined, z.string().max(5000).optional()),
  isActive: z.coerce.boolean().default(true),
});

export const updatePackageSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    destination: z.string().trim().min(1).max(120).optional(),
    nights: z.coerce.number().int().min(0).max(365).optional(),
    days: z.coerce.number().int().min(1).max(366).optional(),
    priceAmount: z.coerce.number().int().nonnegative().max(1_000_000_000).optional(),
    priceCurrency: z.string().trim().length(3).toUpperCase().optional(),
    description: z.preprocess(emptyToNull, z.string().max(5000).nullable()).optional(),
    inclusions: z.preprocess(emptyToNull, z.string().max(5000).nullable()).optional(),
    exclusions: z.preprocess(emptyToNull, z.string().max(5000).nullable()).optional(),
    isActive: z.coerce.boolean().optional(),
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
