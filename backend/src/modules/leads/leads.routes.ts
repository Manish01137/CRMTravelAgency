import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as controller from './leads.controller';
import {
  createActivitySchema,
  createLeadSchema,
  leadIdParam,
  listLeadsQuerySchema,
  updateLeadSchema,
} from './leads.schemas';

const router = Router();

// All lead routes require auth. Both ADMIN and AGENT can manage their org's leads.
router.use(requireAuth);

router.get('/', validate({ query: listLeadsQuerySchema }), asyncHandler(controller.list));
router.get('/stats', asyncHandler(controller.stats));
router.post('/', validate({ body: createLeadSchema }), asyncHandler(controller.create));
router.get('/:id', validate({ params: leadIdParam }), asyncHandler(controller.get));
router.patch(
  '/:id',
  validate({ params: leadIdParam, body: updateLeadSchema }),
  asyncHandler(controller.update),
);
router.delete('/:id', validate({ params: leadIdParam }), asyncHandler(controller.remove));

// Activity timeline (Lead Activity Board).
router.get('/:id/activities', validate({ params: leadIdParam }), asyncHandler(controller.listActivities));
router.post(
  '/:id/activities',
  validate({ params: leadIdParam, body: createActivitySchema }),
  asyncHandler(controller.createActivity),
);

export default router;
