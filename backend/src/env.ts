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

  // --- Phase 3: Communication --------------------------------------------
  // At-rest encryption key for channel credentials (OAuth tokens, provider API
  // keys) stored in ChannelConnection.credentials. Required once any channel
  // is connected. Generate with: openssl rand -hex 32
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'ENCRYPTION_KEY must be a 64-character hex string (32 bytes) — generate with `openssl rand -hex 32`')
    .optional(),

  // Meta App (Developer console) used platform-wide; each organization's own
  // WABA/Instagram account is connected via Embedded Signup and its token is
  // stored per-organization (see ChannelConnection). Optional — WhatsApp/
  // Instagram connect endpoints 503 until these are set.
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  // A second, separate Meta App ("Joinetraa") handles WhatsApp specifically —
  // it has its own App Secret, used only to verify that app's webhook
  // deliveries (see lib/meta.ts's verifyWebhookSignature). Both apps deliver
  // to the same shared /webhooks/meta endpoint.
  META_WHATSAPP_APP_SECRET: z.string().optional(),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  META_GRAPH_VERSION: z.string().default('v21.0'),
  // WhatsApp Embedded Signup "Configuration ID" from Meta App Dashboard →
  // WhatsApp → Embedded Signup. Needed by the frontend for FB.login().
  META_WHATSAPP_CONFIG_ID: z.string().optional(),
  // Instagram Login app id — usually the same as META_APP_ID under one Meta
  // App, but kept separate in case the client uses a dedicated Instagram app.
  META_INSTAGRAM_APP_ID: z.string().optional(),

  // --- Phase 4: Automation (Redis + BullMQ) ------------------------------
  // Bot Flow's inbound-message poller and the follow-up nudge scheduler both
  // run as BullMQ jobs. Optional — like SUPABASE_URL/GEMINI_API_KEY, absence
  // just disables the feature (worker doesn't start, automation endpoints
  // report "not configured") instead of crashing the whole server at boot.
  REDIS_URL: z.string().optional(),

  // --- Signup OTP (Email) --------------------------------------------------
  // A PLATFORM-level Resend account — distinct from any organization's own
  // Email connection (see ChannelConnection). At signup there is no
  // organization yet, so this can't be per-tenant; it belongs to the CRM
  // itself. Optional — signup/start 503s with a clear message until set. No
  // pre-approval needed (unlike the WhatsApp route this replaced) — any
  // verified Resend sending domain works immediately.
  PLATFORM_RESEND_API_KEY: z.string().optional(),
  PLATFORM_EMAIL_FROM_ADDRESS: z.string().optional(),
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
