import { z } from 'zod';

export const conversationChannelParam = z.enum(['WHATSAPP', 'INSTAGRAM']);

// Inbox filter chips: All / Unread (unreadCount > 0) / Favorites (starred).
// "Group" isn't offered here — see inbox.service.ts's listConversations doc
// comment for why.
// Mine / Unassigned: by the agent the chat's lead is assigned to.
export const conversationFilterParam = z.enum(['all', 'unread', 'favorites', 'mine', 'unassigned']).default('all');

// Lead stage chips above the chat list — "none" is chats with no lead attached.
export const LEAD_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'NEGOTIATION', 'WON', 'LOST'] as const;
export const conversationStageParam = z.enum([...LEAD_STAGES, 'none']);

export const listConversationsQuerySchema = z.object({
  channel: conversationChannelParam,
  search: z.string().trim().max(200).optional(),
  filter: conversationFilterParam.optional(),
  stage: conversationStageParam.optional(),
});

export const stageCountsQuerySchema = z.object({ channel: conversationChannelParam });

export const conversationIdParam = z.object({ id: z.string().uuid('Invalid conversation id') });

export const setFavoriteSchema = z.object({ isFavorite: z.boolean() });

// One message of a chat (react / star / info).
export const messageIdParam = z.object({ id: z.string().uuid('Invalid conversation id'), messageId: z.string().uuid('Invalid message id') });
// An emoji, or "" to remove our reaction.
export const reactSchema = z.object({ emoji: z.string().max(16) });
export const starSchema = z.object({ starred: z.boolean() });
export const pinSchema = z.object({ pinned: z.boolean() });
// Several messages at once (Select).
export const bulkMessagesSchema = z.object({
  action: z.enum(['star', 'unstar', 'delete']),
  messageIds: z.array(z.string().uuid()).min(1).max(100),
});
export const forwardSchema = z.object({
  fromConversationId: z.string().uuid(),
  messageIds: z.array(z.string().uuid()).min(1, 'Choose a message to forward').max(20, 'Forward up to 20 messages at a time'),
  toConversationIds: z.array(z.string().uuid()).min(1, 'Choose a chat').max(5, 'Forward to up to 5 chats at a time'),
});
// A Google Maps link (or "lat, lng") → a map pin to send.
export const resolveLocationSchema = z.object({ link: z.string().trim().min(3).max(2000) });
export type PinInput = z.infer<typeof pinSchema>;
export type BulkMessagesInput = z.infer<typeof bulkMessagesSchema>;
export type ForwardInput = z.infer<typeof forwardSchema>;
export type ResolveLocationInput = z.infer<typeof resolveLocationSchema>;
export type ReactInput = z.infer<typeof reactSchema>;
export type StarInput = z.infer<typeof starSchema>;

// Open chat polling: `after` = the newest message the screen already has — only newer ones come back.
export const listMessagesQuerySchema = z.object({ after: z.coerce.date().optional() });
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

// The chat's bot: start its flow again from the beginning, or pause it while the team handles the chat.
export const botControlSchema = z.object({ action: z.enum(['restart', 'pause']) });
export type BotControlInput = z.infer<typeof botControlSchema>;

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const sendMessageSchema = z
  .object({
    body: z.string().trim().max(4096).optional(),
    mediaUrl: z.preprocess(emptyToUndefined, z.string().trim().url().optional()),
    templateName: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
    // WhatsApp: the message in this chat that this one replies to.
    replyToMessageId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
    // WhatsApp: a map pin, or a contact card, instead of text.
    location: z
      .object({
        latitude: z.coerce.number().min(-90).max(90),
        longitude: z.coerce.number().min(-180).max(180),
        name: z.string().trim().max(200).optional(),
        address: z.string().trim().max(300).optional(),
      })
      .optional(),
    contact: z
      .object({
        name: z.string().trim().min(1, 'Add the contact’s name').max(120),
        phone: z.string().trim().regex(/^\+?[\d\s()-]{6,20}$/, 'Enter a valid phone number'),
        email: z.preprocess(emptyToUndefined, z.string().trim().email('Enter a valid email').optional()),
      })
      .optional(),
  })
  // A plain text message still requires real text; an image message can go out
  // with just a caption-less mediaUrl, same as WhatsApp/Instagram themselves allow.
  .refine((v) => !!v.body?.trim() || !!v.mediaUrl || !!v.location || !!v.contact, { message: 'Message cannot be empty', path: ['body'] });

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
export type StageCountsQuery = z.infer<typeof stageCountsQuerySchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type SetFavoriteInput = z.infer<typeof setFavoriteSchema>;

// --- Scheduled messages ------------------------------------------------------------
export const scheduledIdParam = z.object({ id: z.string().uuid('Invalid conversation id'), scheduledId: z.string().uuid('Invalid scheduled message id') });
export const scheduleMessageSchema = z.object({
  sendAt: z.coerce.date({ invalid_type_error: 'Pick a date and time' }),
  message: sendMessageSchema,
});
export const updateScheduledSchema = z
  .object({
    sendAt: z.coerce.date().optional(),
    body: z.string().trim().min(1, 'Message cannot be empty').max(4096).optional(),
  })
  .refine((v) => v.sendAt || v.body, { message: 'Nothing to change' });
export type ScheduleMessageInput = z.infer<typeof scheduleMessageSchema>;
export type UpdateScheduledInput = z.infer<typeof updateScheduledSchema>;
