import { z } from 'zod';

export const CHANNEL_TYPES = ['WHATSAPP', 'INSTAGRAM', 'EMAIL', 'SMS'] as const;
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

export const connectEmailSchema = z.object({
  apiKey: z.string().trim().min(1, 'API key is required'),
  fromAddress: z.string().trim().email('Enter a valid "from" email address'),
});

export const connectSmsSchema = z.object({
  accountSid: z.string().trim().min(1, 'Account SID is required'),
  authToken: z.string().trim().min(1, 'Auth token is required'),
  senderId: z.string().trim().min(1, 'Sender ID / phone number is required'),
});

export type ConnectWhatsAppInput = z.infer<typeof connectWhatsAppSchema>;
export type ConnectInstagramInput = z.infer<typeof connectInstagramSchema>;
export type ConnectEmailInput = z.infer<typeof connectEmailSchema>;
export type ConnectSmsInput = z.infer<typeof connectSmsSchema>;
