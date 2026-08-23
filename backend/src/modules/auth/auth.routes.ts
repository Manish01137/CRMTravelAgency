import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import * as controller from './auth.controller';
import {
  acceptInviteSchema,
  forgotPasswordResendSchema,
  forgotPasswordResetSchema,
  forgotPasswordStartSchema,
  inviteTokenParamSchema,
  loginSchema,
  resendSignupOtpSchema,
  startSignupSchema,
  verifySignupSchema,
} from './auth.schemas';

// Throttle credential-related endpoints to blunt brute-force / abuse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' } },
});

// Tighter limit on the two endpoints that actually trigger a WhatsApp send —
// this is public/unauthenticated, so it's the only thing stopping someone
// from using it to spam arbitrary phone numbers.
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many codes requested — please wait a while and try again' } },
});

const router = Router();

router.post('/signup/start', otpSendLimiter, validate({ body: startSignupSchema }), asyncHandler(controller.startSignup));
router.post('/signup/verify', authLimiter, validate({ body: verifySignupSchema }), asyncHandler(controller.verifySignup));
router.post('/signup/resend-otp', otpSendLimiter, validate({ body: resendSignupOtpSchema }), asyncHandler(controller.resendSignupOtp));
router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(controller.login));
router.post('/forgot-password/start', otpSendLimiter, validate({ body: forgotPasswordStartSchema }), asyncHandler(controller.startPasswordReset));
router.post('/forgot-password/resend', otpSendLimiter, validate({ body: forgotPasswordResendSchema }), asyncHandler(controller.resendPasswordResetOtp));
router.post('/forgot-password/reset', authLimiter, validate({ body: forgotPasswordResetSchema }), asyncHandler(controller.resetPassword));
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
