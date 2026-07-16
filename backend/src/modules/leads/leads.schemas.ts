import { z } from 'zod';

export const LeadSourceEnum = z.enum([
  'WHATSAPP',
  'INSTAGRAM',
  'FACEBOOK',
  'WEBSITE',
  'REFERRAL',
  'WALK_IN',
  'PHONE',
  'MANUAL',
  'OTHER',
]);

export const LeadStatusEnum = z.enum([
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'PROPOSAL_SENT',
  'NEGOTIATION',
  'WON',
  'LOST',
]);

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const emptyToNull = (v: unknown) => (v === '' ? null : v);

export const createLeadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.preprocess(emptyToUndefined, z.string().email('Enter a valid email').max(200).optional()),
  phone: z.preprocess(emptyToUndefined, z.string().trim().max(40).optional()),
  source: LeadSourceEnum.default('MANUAL'),
  status: LeadStatusEnum.default('NEW'),
  destination: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  travelDate: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  travelerCount: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().max(100000).optional(),
  ),
  budgetAmount: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().nonnegative().max(1_000_000_000).optional(),
  ),
  budgetCurrency: z.string().trim().length(3).toUpperCase().optional().default('USD'),
  notes: z.preprocess(emptyToUndefined, z.string().max(5000).optional()),
  assignedToId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export const updateLeadSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.preprocess(emptyToNull, z.string().email('Enter a valid email').max(200).nullable()).optional(),
    phone: z.preprocess(emptyToNull, z.string().trim().max(40).nullable()).optional(),
    source: LeadSourceEnum.optional(),
    status: LeadStatusEnum.optional(),
    destination: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()).optional(),
    travelDate: z.preprocess(emptyToNull, z.coerce.date().nullable()).optional(),
    travelerCount: z.preprocess(emptyToNull, z.coerce.number().int().positive().max(100000).nullable()).optional(),
    budgetAmount: z.preprocess(emptyToNull, z.coerce.number().int().nonnegative().max(1_000_000_000).nullable()).optional(),
    budgetCurrency: z.preprocess(emptyToNull, z.string().trim().length(3).toUpperCase().nullable()).optional(),
    notes: z.preprocess(emptyToNull, z.string().max(5000).nullable()).optional(),
    assignedToId: z.preprocess(emptyToNull, z.string().uuid().nullable()).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'No fields to update' });

export const listLeadsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  // Accepts a single status or a comma-separated list (e.g. "NEGOTIATION,PROPOSAL_SENT"
  // powers the Hot/Warm quick filters on the leads dashboard).
  status: z
    .preprocess(
      (v) => (typeof v === 'string' && v.includes(',') ? v.split(',') : v),
      z.union([LeadStatusEnum, z.array(LeadStatusEnum).min(1).max(7)]),
    )
    .optional(),
  source: LeadSourceEnum.optional(),
  assignedToId: z.union([z.literal('unassigned'), z.string().uuid()]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const leadIdParam = z.object({ id: z.string().uuid('Invalid lead id') });

export const LeadActivityTypeEnum = z.enum(['NOTE', 'CALL', 'WHATSAPP', 'EMAIL', 'MEETING']);

/** Log an interaction; optionally move the lead to a new stage in the same call. */
export const createActivitySchema = z.object({
  type: LeadActivityTypeEnum.default('NOTE'),
  outcome: z.preprocess(emptyToUndefined, z.string().trim().max(60).optional()),
  message: z.preprocess(emptyToUndefined, z.string().max(5000).optional()),
  moveTo: LeadStatusEnum.optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
