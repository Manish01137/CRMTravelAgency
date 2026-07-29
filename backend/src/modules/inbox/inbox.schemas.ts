import { z } from 'zod';

export const conversationChannelParam = z.enum(['WHATSAPP', 'INSTAGRAM']);

export const listConversationsQuerySchema = z.object({
  channel: conversationChannelParam,
  search: z.string().trim().max(200).optional(),
});

export const conversationIdParam = z.object({ id: z.string().uuid('Invalid conversation id') });

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message cannot be empty').max(4096),
  templateName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
});

export const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Template name is required')
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores only'),
  category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']).default('UTILITY'),
  language: z.string().trim().min(2).max(10).default('en_US'),
  bodyText: z.string().trim().min(1, 'Template body is required').max(1024),
});

export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
