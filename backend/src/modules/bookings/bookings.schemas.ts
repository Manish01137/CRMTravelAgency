import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const emptyToNull = (v: unknown) => (v === '' ? null : v);

export const BookingStatusEnum = z.enum(['PENDING', 'CONFIRMED', 'ONGOING', 'COMPLETED', 'CANCELLED']);

const bookingBase = {
  customerName: z.string().trim().min(1, 'Customer name is required').max(120),
  customerEmail: z.preprocess(emptyToUndefined, z.string().email('Enter a valid email').max(200).optional()),
  customerPhone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  destination: z.string().trim().min(1, 'Destination is required').max(120),
  startDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  endDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  travelerCount: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().max(100000).optional()),
  status: BookingStatusEnum.default('PENDING'),
  totalAmount: z.coerce.number().int().nonnegative().max(1_000_000_000).default(0),
  amountPaid: z.coerce.number().int().nonnegative().max(1_000_000_000).default(0),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  notes: z.preprocess(emptyToUndefined, z.string().max(5000).optional()),
  packageId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  assignedToId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
};

export const createBookingSchema = z.object(bookingBase);

export const createFromLeadSchema = z.object({
  // Everything optional — sensible values are copied from the lead.
  customerName: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(120).optional()),
  destination: z.preprocess(emptyToUndefined, z.string().trim().min(1).max(120).optional()),
  startDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  endDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  totalAmount: z.preprocess(emptyToUndefined, z.coerce.number().int().nonnegative().max(1_000_000_000).optional()),
  packageId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export const updateBookingSchema = z
  .object({
    customerName: z.string().trim().min(1).max(120).optional(),
    customerEmail: z.preprocess(emptyToNull, z.string().email().max(200).nullable()).optional(),
    customerPhone: z.preprocess(emptyToNull, z.string().trim().max(40).nullable()).optional(),
    destination: z.string().trim().min(1).max(120).optional(),
    startDate: z.preprocess(emptyToNull, z.coerce.date().nullable()).optional(),
    endDate: z.preprocess(emptyToNull, z.coerce.date().nullable()).optional(),
    travelerCount: z.preprocess(emptyToNull, z.coerce.number().int().positive().max(100000).nullable()).optional(),
    status: BookingStatusEnum.optional(),
    totalAmount: z.coerce.number().int().nonnegative().max(1_000_000_000).optional(),
    amountPaid: z.coerce.number().int().nonnegative().max(1_000_000_000).optional(),
    currency: z.string().trim().length(3).toUpperCase().optional(),
    notes: z.preprocess(emptyToNull, z.string().max(5000).nullable()).optional(),
    packageId: z.preprocess(emptyToNull, z.string().uuid().nullable()).optional(),
    assignedToId: z.preprocess(emptyToNull, z.string().uuid().nullable()).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

export const listBookingsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: BookingStatusEnum.optional(),
  leadId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const itinerarySchema = z.object({
  items: z
    .array(
      z.object({
        dayNumber: z.coerce.number().int().min(1).max(366),
        title: z.string().trim().min(1, 'Title required').max(200),
        subtitle: z.preprocess(emptyToUndefined, z.string().max(300).optional()),
        city: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
        country: z.preprocess(emptyToUndefined, z.string().max(120).optional()),
        description: z.preprocess(emptyToUndefined, z.string().max(5000).optional()),
      }),
    )
    .max(200),
});

export const bookingIdParam = z.object({ id: z.string().uuid('Invalid booking id') });
export const leadIdParam = z.object({ leadId: z.string().uuid('Invalid lead id') });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CreateFromLeadInput = z.infer<typeof createFromLeadSchema>;
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
export type ItineraryInput = z.infer<typeof itinerarySchema>;
