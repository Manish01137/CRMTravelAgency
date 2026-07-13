import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const emptyToNull = (v: unknown) => (v === '' ? null : v);

export const BillCategoryEnum = z.enum(['HOTEL', 'FLIGHT', 'TRANSPORT', 'ACTIVITY', 'VISA', 'FOOD', 'OTHER']);
export const BillStatusEnum = z.enum(['UNPAID', 'PAID']);

export const createBillSchema = z.object({
  bookingId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  vendorName: z.string().trim().min(1, 'Vendor name is required').max(120),
  category: BillCategoryEnum.default('OTHER'),
  amount: z.coerce.number().int().nonnegative().max(1_000_000_000),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  billDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  status: BillStatusEnum.default('UNPAID'),
  notes: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
});

export const updateBillSchema = z
  .object({
    vendorName: z.string().trim().min(1).max(120).optional(),
    category: BillCategoryEnum.optional(),
    amount: z.coerce.number().int().nonnegative().max(1_000_000_000).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    billDate: z.coerce.date().optional(),
    status: BillStatusEnum.optional(),
    notes: z.preprocess(emptyToNull, z.string().max(2000).nullable()).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

export const listBillsQuerySchema = z.object({
  bookingId: z.string().uuid().optional(),
  status: BillStatusEnum.optional(),
});

export const billIdParam = z.object({ id: z.string().uuid('Invalid bill id') });

export type CreateBillInput = z.infer<typeof createBillSchema>;
export type UpdateBillInput = z.infer<typeof updateBillSchema>;
export type ListBillsQuery = z.infer<typeof listBillsQuerySchema>;
