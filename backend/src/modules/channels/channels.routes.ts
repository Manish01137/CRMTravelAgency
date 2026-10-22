import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { BadRequest } from '../../lib/errors';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './channels.controller';
import {
  channelParam,
  connectEmailSchema,
  connectInstagramSchema,
  connectWhatsAppSchema,
  requestWhatsAppCodeSchema,
  selectInstagramPageSchema,
  verifyWhatsAppCodeSchema,
  updateWhatsAppBusinessProfileSchema,
} from './channels.schemas';

// WhatsApp's own profile-picture requirement: JPEG only.
const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'image/jpeg') cb(null, true);
    else cb(new Error('UNSUPPORTED_TYPE'));
  },
});

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
// A number Meta left "Pending": re-check Meta's real status (registering it if
// needed), or finish its SMS / voice code verification.
router.post('/whatsapp/resync', requireRole('ADMIN'), asyncHandler(controller.resyncWhatsApp));
router.post(
  '/whatsapp/request-code',
  requireRole('ADMIN'),
  validate({ body: requestWhatsAppCodeSchema }),
  asyncHandler(controller.requestWhatsAppCode),
);
router.post(
  '/whatsapp/verify-code',
  requireRole('ADMIN'),
  validate({ body: verifyWhatsAppCodeSchema }),
  asyncHandler(controller.verifyWhatsAppCode),
);
router.post(
  '/instagram/connect',
  requireRole('ADMIN'),
  validate({ body: connectInstagramSchema }),
  asyncHandler(controller.connectInstagram),
);
router.post(
  '/instagram/select-page',
  requireRole('ADMIN'),
  validate({ body: selectInstagramPageSchema }),
  asyncHandler(controller.selectInstagramPage),
);
router.patch(
  '/email',
  requireRole('ADMIN'),
  validate({ body: connectEmailSchema }),
  asyncHandler(controller.connectEmail),
);
router.delete(
  '/:channel',
  requireRole('ADMIN'),
  validate({ params: channelParam }),
  asyncHandler(controller.disconnect),
);

// Any team member can view the Business Profile; only ADMIN can edit it —
// same privilege split as connect/disconnect above.
router.get('/whatsapp/business-profile', asyncHandler(controller.getWhatsAppBusinessProfile));
router.patch(
  '/whatsapp/business-profile',
  requireRole('ADMIN'),
  validate({ body: updateWhatsAppBusinessProfileSchema }),
  asyncHandler(controller.updateWhatsAppBusinessProfile),
);
router.post(
  '/whatsapp/business-profile/photo',
  requireRole('ADMIN'),
  (req: Request, res: Response, next) => {
    profilePhotoUpload.single('file')(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return next(BadRequest('Photo is too large (max 5 MB)'));
      }
      if (err instanceof Error && err.message === 'UNSUPPORTED_TYPE') {
        return next(BadRequest('Only JPEG photos are allowed for the WhatsApp profile picture'));
      }
      return next(BadRequest('Could not read the uploaded file'));
    });
  },
  asyncHandler(controller.uploadWhatsAppProfilePhoto),
);

export default router;
