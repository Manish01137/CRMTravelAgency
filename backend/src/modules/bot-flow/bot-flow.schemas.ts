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

export const upsertStepSchema = z
  .object({
    type: z.enum(['COLLECT', 'CONFIRM', 'CLOSING']),
    order: z.coerce.number().int().min(0).max(1000).default(0),
    question: z.preprocess(emptyToUndefined, z.string().max(1000).optional()),
    leadField: z.preprocess(emptyToUndefined, z.enum(LEAD_FIELDS).optional()),
    options: z.array(confirmOptionSchema).max(10).optional(),
    nextStepId: z.string().uuid().nullable().optional(),
    canvasX: z.coerce.number().int().optional(),
    canvasY: z.coerce.number().int().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'COLLECT' && !v.leadField) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A COLLECT step needs a target Lead field', path: ['leadField'] });
    }
    if (v.type === 'CONFIRM' && (!v.options || v.options.length < 2)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'A CONFIRM step needs at least 2 options', path: ['options'] });
    }
    if ((v.type === 'COLLECT' || v.type === 'CONFIRM') && !v.question) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Question text is required', path: ['question'] });
    }
    if (v.type === 'CLOSING' && !v.question) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Closing message is required', path: ['question'] });
    }
  });

export const assignFlowSchema = z.object({
  channel: z.enum(['WHATSAPP', 'INSTAGRAM']),
  flowId: z.string().uuid('Invalid flow id'),
});

export const unassignParam = z.object({ channel: z.enum(['WHATSAPP', 'INSTAGRAM']) });

export type CreateFlowInput = z.infer<typeof createFlowSchema>;
export type UpdateFlowInput = z.infer<typeof updateFlowSchema>;
export type UpsertStepInput = z.infer<typeof upsertStepSchema>;
export type AssignFlowInput = z.infer<typeof assignFlowSchema>;
