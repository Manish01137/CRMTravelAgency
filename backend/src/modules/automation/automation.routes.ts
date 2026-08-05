import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './automation.controller';
import { listAttemptsQuerySchema, updateAutomationSchema } from './automation.schemas';

const router = Router();
router.use(requireAuth);

router.get('/settings', asyncHandler(controller.getSettings));
router.patch('/settings', requireRole('ADMIN'), validate({ body: updateAutomationSchema }), asyncHandler(controller.updateSettings));
router.get('/attempts', validate({ query: listAttemptsQuerySchema }), asyncHandler(controller.listAttempts));

export default router;
