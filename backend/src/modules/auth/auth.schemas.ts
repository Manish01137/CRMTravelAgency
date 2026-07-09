import { z } from 'zod';

export const signupSchema = z.object({
  organizationName: z.string().trim().min(2, 'Agency name is too short').max(80),
  name: z.string().trim().min(1, 'Your name is required').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const acceptInviteSchema = z.object({
  token: z.string().min(10, 'Invalid invitation token'),
  name: z.string().trim().min(1, 'Your name is required').max(80),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export const inviteTokenParamSchema = z.object({
  token: z.string().min(10),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
