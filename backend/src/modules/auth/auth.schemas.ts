import { z } from 'zod';

export const startSignupSchema = z.object({
  organizationName: z.string().trim().min(2, 'Agency name is too short').max(80),
  name: z.string().trim().min(1, 'Your name is required').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export const verifySignupSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});

export const resendSignupOtpSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordStartSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
});

export const forgotPasswordResendSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
});

export const forgotPasswordResetSchema = z
  .object({
    email: z.string().trim().toLowerCase().email('Enter a valid email'),
    otp: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').max(100),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const acceptInviteSchema = z.object({
  token: z.string().min(10, 'Invalid invitation token'),
  name: z.string().trim().min(1, 'Your name is required').max(80),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export const inviteTokenParamSchema = z.object({
  token: z.string().min(10),
});

export type StartSignupInput = z.infer<typeof startSignupSchema>;
export type VerifySignupInput = z.infer<typeof verifySignupSchema>;
export type ResendSignupOtpInput = z.infer<typeof resendSignupOtpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordStartInput = z.infer<typeof forgotPasswordStartSchema>;
export type ForgotPasswordResendInput = z.infer<typeof forgotPasswordResendSchema>;
export type ForgotPasswordResetInput = z.infer<typeof forgotPasswordResetSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
