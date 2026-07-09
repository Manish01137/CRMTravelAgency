import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './org.controller';
import { updateOrgSchema } from './org.schemas';

const router = Router();

router.get('/', requireAuth, asyncHandler(controller.getOrganization));
router.patch(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: updateOrgSchema }),
  asyncHandler(controller.updateOrganization),
);

export default router;
