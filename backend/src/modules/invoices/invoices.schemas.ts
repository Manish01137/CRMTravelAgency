import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const emptyToNull = (v: unknown) => (v === '' ? null : v);

export const InvoiceStatusEnum = z.enum(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED']);

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, 'Description required').max(300),
  quantity: z.coerce.number().int().positive().max(10000).default(1),
  unitPrice: z.coerce.number().int().nonnegative().max(1_000_000_000),
});

export const createInvoiceSchema = z.object({
  bookingId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  customerName: z.string().trim().min(1, 'Customer name is required').max(120),
  customerEmail: z.preprocess(emptyToUndefined, z.string().email().max(200).optional()),
  customerPhone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  status: InvoiceStatusEnum.default('DRAFT'),
  issueDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  dueDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  items: z.array(lineItemSchema).min(1, 'Add at least one line item').max(100),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  notes: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
});

export const updateInvoiceSchema = z
  .object({
    customerName: z.string().trim().min(1).max(120).optional(),
    customerEmail: z.preprocess(emptyToNull, z.string().email().max(200).nullable()).optional(),
    customerPhone: z.preprocess(emptyToNull, z.string().trim().max(40).nullable()).optional(),
    status: InvoiceStatusEnum.optional(),
    issueDate: z.coerce.date().optional(),
    dueDate: z.preprocess(emptyToNull, z.coerce.date().nullable()).optional(),
    items: z.array(lineItemSchema).min(1).max(100).optional(),
    taxPercent: z.coerce.number().min(0).max(100).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    notes: z.preprocess(emptyToNull, z.string().max(2000).nullable()).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

export const listInvoicesQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: InvoiceStatusEnum.optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const invoiceIdParam = z.object({ id: z.string().uuid('Invalid invoice id') });
export const bookingIdParamInv = z.object({ bookingId: z.string().uuid('Invalid booking id') });

export type LineItem = z.infer<typeof lineItemSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type ListInvoicesQuery = z.infer<typeof listInvoicesQuerySchema>;
