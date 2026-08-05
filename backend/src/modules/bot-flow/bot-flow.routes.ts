import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './bot-flow.controller';
import {
  assignFlowSchema,
  createFlowSchema,
  flowIdParam,
  stepIdParam,
  unassignParam,
  updateFlowSchema,
  upsertStepSchema,
} from './bot-flow.schemas';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(controller.list));
router.post('/', requireRole('ADMIN'), validate({ body: createFlowSchema }), asyncHandler(controller.create));
router.get('/:id', validate({ params: flowIdParam }), asyncHandler(controller.get));
router.patch('/:id', requireRole('ADMIN'), validate({ params: flowIdParam, body: updateFlowSchema }), asyncHandler(controller.update));
router.delete('/:id', requireRole('ADMIN'), validate({ params: flowIdParam }), asyncHandler(controller.remove));

router.post('/:id/steps', requireRole('ADMIN'), validate({ params: flowIdParam, body: upsertStepSchema }), asyncHandler(controller.createStep));
router.patch('/:id/steps/:stepId', requireRole('ADMIN'), validate({ params: stepIdParam, body: upsertStepSchema }), asyncHandler(controller.updateStep));
router.delete('/:id/steps/:stepId', requireRole('ADMIN'), validate({ params: stepIdParam }), asyncHandler(controller.deleteStep));

router.get('/assignments/all', asyncHandler(controller.listAssignments));
router.post('/assignments', requireRole('ADMIN'), validate({ body: assignFlowSchema }), asyncHandler(controller.assign));
router.delete('/assignments/:channel', requireRole('ADMIN'), validate({ params: unassignParam }), asyncHandler(controller.unassign));

export default router;
