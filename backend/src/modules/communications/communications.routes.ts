import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as controller from './communications.controller';
import { leadIdParam, sendEmailSchema } from './communications.schemas';

const router = Router();
router.use(requireAuth);

router.get('/leads/:leadId/log', validate({ params: leadIdParam }), asyncHandler(controller.listLog));
router.post('/leads/:leadId/email', validate({ params: leadIdParam, body: sendEmailSchema }), asyncHandler(controller.sendEmail));

export default router;
