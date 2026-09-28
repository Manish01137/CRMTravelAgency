import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const updateSettingsSchema = z.object({
  systemPrompt: z.preprocess(emptyToUndefined, z.string().max(4000).optional()),
  agencyFacts: z.preprocess(emptyToUndefined, z.string().max(4000).optional()),
  tone: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
});

export const conversationIdBody = z.object({ conversationId: z.string().uuid('Invalid conversation id') });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
