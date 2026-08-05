import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

export const updateSettingsSchema = z.object({
  systemPrompt: z.preprocess(emptyToUndefined, z.string().max(4000).optional()),
  agencyFacts: z.preprocess(emptyToUndefined, z.string().max(4000).optional()),
  tone: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
  // Omit to leave the stored key unchanged; empty string is rejected by the
  // service layer's own "use DELETE /ai-agent/settings/key to clear" message.
  geminiApiKey: z.preprocess(emptyToUndefined, z.string().min(1).max(500).optional()),
});

export const conversationIdBody = z.object({ conversationId: z.string().uuid('Invalid conversation id') });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
