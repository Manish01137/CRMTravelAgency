import { z } from 'zod';

export const conversationChannelParam = z.enum(['WHATSAPP', 'INSTAGRAM']);

// Inbox filter chips: All / Unread (unreadCount > 0) / Favorites (starred).
// "Group" isn't offered here — see inbox.service.ts's listConversations doc
// comment for why.
export const conversationFilterParam = z.enum(['all', 'unread', 'favorites']).default('all');

export const listConversationsQuerySchema = z.object({
  channel: conversationChannelParam,
  search: z.string().trim().max(200).optional(),
  filter: conversationFilterParam.optional(),
});

export const conversationIdParam = z.object({ id: z.string().uuid('Invalid conversation id') });

export const setFavoriteSchema = z.object({ isFavorite: z.boolean() });

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const sendMessageSchema = z
  .object({
    body: z.string().trim().max(4096).optional(),
    mediaUrl: z.preprocess(emptyToUndefined, z.string().trim().url().optional()),
    templateName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  })
  // A plain text message still requires real text; an image message can go out
  // with just a caption-less mediaUrl, same as WhatsApp/Instagram themselves allow.
  .refine((v) => !!v.body?.trim() || !!v.mediaUrl, { message: 'Message cannot be empty', path: ['body'] });

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
  /** One example value per {{n}} variable in bodyText, in order — required by Meta whenever the body has variables. */
  bodyExamples: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
});

export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type SetFavoriteInput = z.infer<typeof setFavoriteSchema>;
