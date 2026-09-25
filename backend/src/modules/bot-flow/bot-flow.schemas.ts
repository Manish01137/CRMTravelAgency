import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

// Kept independent of any Prisma-generated union so the frontend/back end
// agree on exactly this list without importing generated types across the
// HTTP boundary (same style as the rest of the codebase's schemas).
export const LEAD_FIELDS = ['name', 'email', 'phone', 'destination', 'travelDate', 'travelerCount', 'notes'] as const;

export const flowIdParam = z.object({ id: z.string().uuid('Invalid flow id') });
export const stepIdParam = z.object({ id: z.string().uuid('Invalid flow id'), stepId: z.string().uuid('Invalid step id') });

export const createFlowSchema = z.object({
  name: z.string().trim().min(1, 'Flow name is required').max(150),
  fallbackMessage: z.preprocess(emptyToUndefined, z.string().max(1000).optional()),
  needsReviewKeywords: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  isActive: z.coerce.boolean().default(true),
});

export const updateFlowSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    fallbackMessage: z.preprocess(emptyToUndefined, z.string().max(1000).optional()),
    needsReviewKeywords: z.array(z.string().trim().min(1).max(80)).max(50).optional(),
    isActive: z.coerce.boolean().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

const confirmOptionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  nextStepId: z.string().uuid().nullable(),
});

// SEND_PACKAGE's packageId, AI_OPEN's instructions, CAROUSEL's packageIds —
// one shared shape rather than a discriminated union, since each type only
// ever reads its own key.
const stepConfigSchema = z.object({
  packageId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  instructions: z.preprocess(emptyToUndefined, z.string().max(2000).optional()),
  packageIds: z.array(z.string().uuid()).max(10, 'A WhatsApp list message can hold at most 10 rows').optional(),
});

export const upsertStepSchema = z
  .object({
    type: z.enum(['COLLECT', 'CONFIRM', 'CLOSING', 'MESSAGE', 'HANDOFF', 'SEND_PACKAGE', 'AI_OPEN', 'CAROUSEL']),
    order: z.coerce.number().int().min(0).max(1000).default(0),
    question: z.preprocess(emptyToUndefined, z.string().max(1000).optional()),
    leadField: z.preprocess(emptyToUndefined, z.enum(LEAD_FIELDS).optional()),
    // .nullish() (not just .optional()) on these three: the frontend's step
    // editor sends the WHOLE step back on every save (see updateStepMutation
    // in BotFlowBuilderPage.tsx), and options/canvasX/canvasY all come back
    // as an explicit `null` from Prisma for a step that's never set them
    // (e.g. any non-CONFIRM step's `options`) — .optional() alone rejects
    // that null outright, which is exactly what "Validation failed" on
    // every save of a CONFIRM-free flow turned out to be.
    options: z.array(confirmOptionSchema).max(10).nullish(),
    nextStepId: z.string().uuid().nullable().optional(),
    config: stepConfigSchema.default({}),
    canvasX: z.coerce.number().int().nullish(),
    canvasY: z.coerce.number().int().nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'COLLECT' && !v.leadField) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A COLLECT step needs a target Lead field', path: ['leadField'] });
    }
    if (v.type === 'CONFIRM' && (!v.options || v.options.length < 2)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A CONFIRM step needs at least 2 options', path: ['options'] });
    }
    if (['COLLECT', 'CONFIRM', 'CLOSING', 'MESSAGE', 'AI_OPEN'].includes(v.type) && !v.question) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Message text is required', path: ['question'] });
    }
    // config.packageId (SEND_PACKAGE) / config.instructions (AI_OPEN) /
    // config.packageIds (CAROUSEL) are deliberately NOT required here — a
    // step can be added blank from the toolbar and configured afterward,
    // same as every other type. The engine degrades gracefully when any of
    // them is unset (see bot-flow.engine.ts).
  });

export const assignFlowSchema = z.object({
  channel: z.enum(['WHATSAPP', 'INSTAGRAM']),
  flowId: z.string().uuid('Invalid flow id'),
});

export const unassignParam = z.object({ channel: z.enum(['WHATSAPP', 'INSTAGRAM']) });

// Ready-made starter flows — see bot-flow.templates.ts for the actual step definitions.
export const TEMPLATE_KEYS = ['travel_enquiry', 'booking_followup'] as const;
export const createFromTemplateSchema = z.object({
  templateKey: z.enum(TEMPLATE_KEYS),
});

export type CreateFlowInput = z.infer<typeof createFlowSchema>;
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];
export type CreateFromTemplateInput = z.infer<typeof createFromTemplateSchema>;
export type UpsertStepInput = z.infer<typeof upsertStepSchema>;
export type AssignFlowInput = z.infer<typeof assignFlowSchema>;
