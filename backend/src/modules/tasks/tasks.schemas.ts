import { z } from 'zod';

const emptyToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);
const emptyToNull = (v: unknown) => (v === '' ? null : v);

export const TaskTypeEnum = z.enum(['FOLLOW_UP', 'CALL', 'MEETING', 'OTHER']);
export const TaskStatusEnum = z.enum(['PENDING', 'DONE']);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  notes: z.preprocess(emptyToUndefined, z.string().max(5000).optional()),
  type: TaskTypeEnum.default('FOLLOW_UP'),
  dueAt: z.coerce.date(),
  leadId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  bookingId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  assignedToId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    notes: z.preprocess(emptyToNull, z.string().max(5000).nullable()).optional(),
    type: TaskTypeEnum.optional(),
    status: TaskStatusEnum.optional(),
    dueAt: z.coerce.date().optional(),
    assignedToId: z.preprocess(emptyToNull, z.string().uuid().nullable()).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'No fields to update' });

export const listTasksQuerySchema = z.object({
  status: TaskStatusEnum.optional(),
  assignedToId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  bookingId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const taskIdParam = z.object({ id: z.string().uuid('Invalid task id') });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
