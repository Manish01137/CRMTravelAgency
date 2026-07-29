import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './channels.controller';
import { channelParam, connectEmailSchema, connectInstagramSchema, connectSmsSchema, connectWhatsAppSchema } from './channels.schemas';

const router = Router();
router.use(requireAuth);

// Any team member can see connection status; only ADMIN can connect/disconnect
// (same privilege level as Settings → Organization).
router.get('/config', asyncHandler(controller.getConfig));
router.get('/', asyncHandler(controller.list));

router.post(
  '/whatsapp/connect',
  requireRole('ADMIN'),
  validate({ body: connectWhatsAppSchema }),
  asyncHandler(controller.connectWhatsApp),
);
router.post(
  '/instagram/connect',
  requireRole('ADMIN'),
  validate({ body: connectInstagramSchema }),
  asyncHandler(controller.connectInstagram),
);
router.patch(
  '/email',
  requireRole('ADMIN'),
  validate({ body: connectEmailSchema }),
  asyncHandler(controller.connectEmail),
);
router.patch(
  '/sms',
  requireRole('ADMIN'),
  validate({ body: connectSmsSchema }),
  asyncHandler(controller.connectSms),
);
router.delete(
  '/:channel',
  requireRole('ADMIN'),
  validate({ params: channelParam }),
  asyncHandler(controller.disconnect),
);

export default router;
