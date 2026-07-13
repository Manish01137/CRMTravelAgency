import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as service from './tasks.service';
import {
  createTaskSchema,
  listTasksQuerySchema,
  taskIdParam,
  updateTaskSchema,
  type ListTasksQuery,
} from './tasks.schemas';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  validate({ query: listTasksQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.listTasks(req.auth!.organizationId, req.query as unknown as ListTasksQuery));
  }),
);

router.post(
  '/',
  validate({ body: createTaskSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await service.createTask(req.auth!.organizationId, req.body));
  }),
);

router.patch(
  '/:id',
  validate({ params: taskIdParam, body: updateTaskSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await service.updateTask(req.auth!.organizationId, req.params.id, req.body));
  }),
);

router.delete(
  '/:id',
  validate({ params: taskIdParam }),
  asyncHandler(async (req: Request, res: Response) => {
    await service.deleteTask(req.auth!.organizationId, req.params.id);
    res.json({ ok: true });
  }),
);

export default router;
