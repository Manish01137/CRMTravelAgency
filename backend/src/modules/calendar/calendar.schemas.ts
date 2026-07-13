import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const emptyToNull = (v: unknown) => (v === '' ? null : v);

export const createEventSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  date: z.coerce.date(),
  notes: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{6})$/, 'Use a hex color like #4F46E5')
    .default('#4F46E5'),
});

export const updateEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    date: z.coerce.date().optional(),
    notes: z.preprocess(emptyToNull, z.string().max(2000).nullable()).optional(),
    color: z.string().regex(/^#([0-9a-fA-F]{6})$/).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

export const calendarQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const eventIdParam = z.object({ id: z.string().uuid('Invalid event id') });

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
