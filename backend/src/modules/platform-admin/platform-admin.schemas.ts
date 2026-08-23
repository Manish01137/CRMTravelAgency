import { z } from 'zod';

export const platformAdminLoginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const listOrganizationsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  role: z.enum(['ADMIN', 'AGENT']).optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'DISABLED']).optional(),
  organizationId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const orgIdParam = z.object({ id: z.string().uuid('Invalid organization id') });
export const userIdParam = z.object({ id: z.string().uuid('Invalid user id') });

export const updateOrganizationStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED']),
  reason: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(500).optional()),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'DISABLED']),
});

export const createOrganizationSchema = z.object({
  organizationName: z.string().trim().min(1, 'Organization name is required').max(120),
  adminName: z.string().trim().min(1, "Admin's name is required").max(120),
  adminEmail: z.string().trim().email('Enter a valid email'),
  // Optional — a strong random password is generated when omitted.
  adminPassword: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(12).max(200).optional()),
});

export const addOrganizationNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note cannot be empty').max(5000),
});

export const noteIdParam = z.object({ id: z.string().uuid('Invalid organization id'), noteId: z.string().uuid('Invalid note id') });

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'Enter something to search for').max(200),
});

export const growthQuerySchema = z.object({
  weeks: z.coerce.number().int().positive().max(52).default(12),
});

export const auditLogQuerySchema = z.object({
  targetType: z.enum(['ORGANIZATION', 'USER', 'EXPENSE']).optional(),
  targetId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(30),
});

export const listLeadsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  organizationId: z.string().uuid().optional(),
  status: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const listBookingsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  organizationId: z.string().uuid().optional(),
  status: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

// --- Finance (manual tracking — no payment gateway) --------------------------
export const upsertSubscriptionSchema = z.object({
  planName: z.string().trim().min(1, 'Plan name is required').max(80),
  amount: z.coerce.number().int().nonnegative().max(1_000_000_000),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']).default('ACTIVE'),
  startedAt: z.coerce.date(),
  renewsAt: z.coerce.date().optional(),
  notes: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(1000).optional()),
});

export const createExpenseSchema = z.object({
  description: z.string().trim().min(1, 'Description is required').max(200),
  category: z.enum(['HOSTING', 'API_COSTS', 'SOFTWARE', 'MARKETING', 'PAYROLL', 'OTHER']).default('OTHER'),
  amount: z.coerce.number().int().nonnegative().max(1_000_000_000),
  currency: z.string().trim().length(3).toUpperCase().default('INR'),
  expenseDate: z.coerce.date(),
});

export const expenseIdParam = z.object({ id: z.string().uuid('Invalid expense id') });

export const financeQuerySchema = z.object({
  months: z.coerce.number().int().positive().max(24).default(6),
});

export type PlatformAdminLoginInput = z.infer<typeof platformAdminLoginSchema>;
export type ListOrganizationsQuery = z.infer<typeof listOrganizationsQuerySchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateOrganizationStatusInput = z.infer<typeof updateOrganizationStatusSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type AddOrganizationNoteInput = z.infer<typeof addOrganizationNoteSchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type GrowthQuery = z.infer<typeof growthQuerySchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type ListBookingsQuery = z.infer<typeof listBookingsQuerySchema>;
export type UpsertSubscriptionInput = z.infer<typeof upsertSubscriptionSchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type FinanceQuery = z.infer<typeof financeQuerySchema>;
