import { z } from 'zod';

// Local copy of the lead-id param (not imported from the Leads module — Phase 3
// deliberately never touches Leads' own files; this module only reads/writes
// the shared `Lead` Prisma model directly, same as Bookings/Tasks already do).
export const leadIdParam = z.object({ leadId: z.string().uuid('Invalid lead id') });

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const sendEmailSchema = z.object({
  subject: z.string().trim().min(1, 'Subject is required').max(200),
  body: z.string().trim().min(1, 'Message body is required').max(20000),
  to: z.preprocess(emptyToUndefined, z.string().email('Enter a valid email').optional()),
});

export type SendEmailInput = z.infer<typeof sendEmailSchema>;
