import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const updateAutomationSchema = z.object({
  enabled: z.coerce.boolean().optional(),
  delayHours: z.coerce.number().int().min(1).max(720).optional(), // up to 30 days
  nudgeMessage: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
});

export const listAttemptsQuerySchema = z.object({
  leadId: z.string().uuid().optional(),
});

export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;
export type ListAttemptsQuery = z.infer<typeof listAttemptsQuerySchema>;
