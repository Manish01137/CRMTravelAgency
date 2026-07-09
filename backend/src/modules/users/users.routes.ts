import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import * as controller from './users.controller';
import {
  invitationIdParam,
  inviteUserSchema,
  updateProfileSchema,
  updateUserSchema,
  userIdParam,
} from './users.schemas';

const router = Router();

// Any authenticated member can list the team (needed for lead assignment).
router.get('/', requireAuth, asyncHandler(controller.list));

// Self-service profile update (declared before '/:id' so "me" isn't treated as an id).
router.patch(
  '/me',
  requireAuth,
  validate({ body: updateProfileSchema }),
  asyncHandler(controller.updateMe),
);

// Everything below is admin-only team management.
router.get('/invitations', requireAuth, requireRole('ADMIN'), asyncHandler(controller.listInvitations));
router.post(
  '/invite',
  requireAuth,
  requireRole('ADMIN'),
  validate({ body: inviteUserSchema }),
  asyncHandler(controller.invite),
);
router.post(
  '/invitations/:id/revoke',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: invitationIdParam }),
  asyncHandler(controller.revokeInvitation),
);
router.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: userIdParam, body: updateUserSchema }),
  asyncHandler(controller.update),
);
router.delete(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate({ params: userIdParam }),
  asyncHandler(controller.remove),
);

export default router;
