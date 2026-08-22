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
  targetType: z.enum(['ORGANIZATION', 'USER']).optional(),
  targetId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(30),
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
