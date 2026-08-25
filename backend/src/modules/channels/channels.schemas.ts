import { z } from 'zod';

export const CHANNEL_TYPES = ['WHATSAPP', 'INSTAGRAM', 'EMAIL'] as const;
export const channelParam = z.object({ channel: z.enum(CHANNEL_TYPES) });

export const connectWhatsAppSchema = z.object({
  code: z.string().trim().min(1, 'Missing authorization code'),
  wabaId: z.string().trim().min(1, 'Missing WhatsApp Business Account id'),
  phoneNumberId: z.string().trim().min(1, 'Missing phone number id'),
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

export type ConnectWhatsAppInput = z.infer<typeof connectWhatsAppSchema>;
export type ConnectInstagramInput = z.infer<typeof connectInstagramSchema>;
export type SelectInstagramPageInput = z.infer<typeof selectInstagramPageSchema>;
export type ConnectEmailInput = z.infer<typeof connectEmailSchema>;
