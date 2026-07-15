import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Privileged/owner connection — migrations + narrow auth surface.
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Restricted runtime connection (crm_app role) — RLS enforced. Optional; falls
  // back to DATABASE_URL with a warning (see src/lib/prisma.ts).
  APP_DATABASE_URL: z.string().optional(),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  AUTH_COOKIE_NAME: z.string().default('crm_token'),

  // Supabase Storage (image uploads) — optional; upload endpoint 503s if unset.
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('uploads'),

  // Google Gemini (AI package generation). Optional — feature is gated behind it.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('✗ Invalid environment configuration:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
