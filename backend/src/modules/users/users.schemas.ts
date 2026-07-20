import { z } from 'zod';

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  role: z.enum(['ADMIN', 'AGENT']).default('AGENT'),
});

const emptyToNull = (v: unknown) => (v === '' ? null : v);

export const updateUserSchema = z
  .object({
    role: z.enum(['ADMIN', 'AGENT']).optional(),
    status: z.enum(['ACTIVE', 'DISABLED']).optional(),
    // Host Page public profile (admin-set per member)
    featureOnHostpage: z.coerce.boolean().optional(),
    publicPhotoUrl: z.preprocess(emptyToNull, z.string().url().max(2000).nullable()).optional(),
    publicTitle: z.preprocess(emptyToNull, z.string().trim().max(120).nullable()).optional(),
    publicBio: z.preprocess(emptyToNull, z.string().max(500).nullable()).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, { message: 'No changes provided' });

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(80).optional(),
    currentPassword: z.string().min(1).optional(),
    newPassword: z.string().min(8, 'Use at least 8 characters').max(100).optional(),
  })
  .refine((o) => o.name !== undefined || o.newPassword !== undefined, {
    message: 'Nothing to update',
  })
  .refine((o) => !o.newPassword || !!o.currentPassword, {
    message: 'Enter your current password',
    path: ['currentPassword'],
  });

export const userIdParam = z.object({ id: z.string().uuid('Invalid user id') });
export const invitationIdParam = z.object({ id: z.string().uuid('Invalid invitation id') });

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
