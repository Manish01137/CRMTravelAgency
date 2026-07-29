import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as controller from './call-log.controller';
import { listCallLogQuerySchema } from './call-log.schemas';

const router = Router();
router.use(requireAuth);

router.get('/', validate({ query: listCallLogQuerySchema }), asyncHandler(controller.list));

export default router;
