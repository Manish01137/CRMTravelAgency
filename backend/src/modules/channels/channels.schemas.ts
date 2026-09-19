import { z } from 'zod';

export const CHANNEL_TYPES = ['WHATSAPP', 'INSTAGRAM', 'EMAIL'] as const;
export const channelParam = z.object({ channel: z.enum(CHANNEL_TYPES) });

// wabaId/phoneNumberId are optional: on some mobile browsers, the WhatsApp
// Embedded Signup popup's window.opener link gets severed, so its
// WA_EMBEDDED_SIGNUP postMessage (which is where these normally come from)
// never arrives — the frontend falls back to sending just `code` after a
// short grace period (see metaSignup.ts). channels.service.ts then discovers
// them itself via Graph API using the exchanged token.
export const connectWhatsAppSchema = z.object({
  code: z.string().trim().min(1, 'Missing authorization code'),
  wabaId: z.string().trim().min(1).optional(),
  phoneNumberId: z.string().trim().min(1).optional(),
});

export const connectInstagramSchema = z.object({
  code: z.string().trim().min(1, 'Missing authorization code'),
  redirectUri: z.string().trim().url('Invalid redirect URI'),
});

/**
 * Second step, only needed when connectInstagram found more than one Facebook
 * Page with a linked Instagram account — the frontend shows a picker built
 * from that response's `options`, and posts the chosen one back here as-is.
 */
export const selectInstagramPageSchema = z.object({
  pageId: z.string().trim().min(1),
  pageName: z.string().trim().min(1),
  instagramBusinessAccountId: z.string().trim().min(1),
  instagramUsername: z.string().trim().min(1),
  pageAccessToken: z.string().trim().min(1),
});

export const connectEmailSchema = z.object({
  apiKey: z.string().trim().min(1, 'API key is required'),
  fromAddress: z.string().trim().email('Enter a valid "from" email address'),
});

// Meta's fixed "industry" list for a WhatsApp Business Profile.
export const WHATSAPP_VERTICALS = [
  'UNDEFINED',
  'OTHER',
  'AUTO',
  'BEAUTY',
  'APPAREL',
  'EDU',
  'ENTERTAIN',
  'EVENT_PLAN',
  'FINANCE',
  'GROCERY',
  'GOVT',
  'HOTEL',
  'HEALTH',
  'NONPROFIT',
  'PROF_SERVICES',
  'RETAIL',
  'TRAVEL',
  'RESTAURANT',
  'NOT_A_BIZ',
] as const;

// NOTE: unlike most forms in this app, an empty string here is NOT treated as
// "omit this field" — this is a full profile editor, so clearing a field in
// the form must actually clear it on Meta's side (see updateWhatsAppBusinessProfile
// in lib/meta.ts, which only skips a key when it's genuinely `undefined`).
export const updateWhatsAppBusinessProfileSchema = z.object({
  about: z.string().trim().max(139, 'Keep it under 139 characters').optional(),
  description: z.string().trim().max(512, 'Keep it under 512 characters').optional(),
  address: z.string().trim().max(256).optional(),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]).pipe(z.string().max(200)).optional(),
  websites: z.array(z.string().trim().url('Enter a valid URL').max(200)).max(2, 'Up to 2 websites').optional(),
  vertical: z.enum(WHATSAPP_VERTICALS).optional(),
});

export type ConnectWhatsAppInput = z.infer<typeof connectWhatsAppSchema>;
export type ConnectInstagramInput = z.infer<typeof connectInstagramSchema>;
export type SelectInstagramPageInput = z.infer<typeof selectInstagramPageSchema>;
export type ConnectEmailInput = z.infer<typeof connectEmailSchema>;
export type UpdateWhatsAppBusinessProfileInput = z.infer<typeof updateWhatsAppBusinessProfileSchema>;
