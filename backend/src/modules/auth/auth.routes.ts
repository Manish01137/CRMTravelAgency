import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as controller from './auth.controller';
import {
  acceptInviteSchema,
  inviteTokenParamSchema,
  loginSchema,
  signupSchema,
} from './auth.schemas';

// Throttle credential-related endpoints to blunt brute-force / abuse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' } },
});

const router = Router();

router.post('/signup', authLimiter, validate({ body: signupSchema }), asyncHandler(controller.signup));
router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(controller.login));
router.post('/logout', asyncHandler(controller.logout));
router.get('/me', requireAuth, asyncHandler(controller.me));
router.get(
  '/invite/:token',
  validate({ params: inviteTokenParamSchema }),
  asyncHandler(controller.invitePreview),
);
router.post(
  '/accept-invite',
  authLimiter,
  validate({ body: acceptInviteSchema }),
  asyncHandler(controller.acceptInvite),
);

export default router;
