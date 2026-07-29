import { z } from 'zod';

export const listCallLogQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export type ListCallLogQuery = z.infer<typeof listCallLogQuerySchema>;
