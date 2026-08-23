import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../lib/validate';
import { requirePlatformAdmin } from '../../middleware/platformAdmin';
import * as controller from './platform-admin.controller';
import {
  addOrganizationNoteSchema,
  auditLogQuerySchema,
  createExpenseSchema,
  createOrganizationSchema,
  expenseIdParam,
  financeQuerySchema,
  growthQuerySchema,
  listBookingsQuerySchema,
  listLeadsQuerySchema,
  listOrganizationsQuerySchema,
  listUsersQuerySchema,
  noteIdParam,
  orgIdParam,
  platformAdminLoginSchema,
  searchQuerySchema,
  updateOrganizationStatusSchema,
  updateUserStatusSchema,
  upsertSubscriptionSchema,
  userIdParam,
} from './platform-admin.schemas';

/**
 * The Super Admin panel's entire backend surface. Every route below either
 * IS the login, or requires requirePlatformAdmin — a JWT scope completely
 * separate from the tenant `requireAuth`. Nothing here is reachable with an
 * ordinary organization admin's session, no matter how privileged their
 * tenant role is.
 */

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, please try again later' } },
});

const router = Router();

router.post('/login', loginLimiter, validate({ body: platformAdminLoginSchema }), asyncHandler(controller.login));
router.post('/logout', asyncHandler(controller.logout));

router.use(requirePlatformAdmin);

router.get('/me', asyncHandler(controller.me));
router.get('/stats', asyncHandler(controller.stats));
router.get('/growth', validate({ query: growthQuerySchema }), asyncHandler(controller.growth));
router.get('/channel-health', asyncHandler(controller.channelHealth));
router.get('/search', validate({ query: searchQuerySchema }), asyncHandler(controller.search));
router.get('/audit-log', validate({ query: auditLogQuerySchema }), asyncHandler(controller.auditLog));

router.get('/organizations', validate({ query: listOrganizationsQuerySchema }), asyncHandler(controller.listOrganizations));
router.post('/organizations', validate({ body: createOrganizationSchema }), asyncHandler(controller.createOrganization));
router.get('/organizations/:id', validate({ params: orgIdParam }), asyncHandler(controller.getOrganization));
router.patch(
  '/organizations/:id/status',
  validate({ params: orgIdParam, body: updateOrganizationStatusSchema }),
  asyncHandler(controller.updateOrganizationStatus),
);
router.get('/organizations/:id/notes', validate({ params: orgIdParam }), asyncHandler(controller.listOrganizationNotes));
router.post(
  '/organizations/:id/notes',
  validate({ params: orgIdParam, body: addOrganizationNoteSchema }),
  asyncHandler(controller.addOrganizationNote),
);
router.delete(
  '/organizations/:id/notes/:noteId',
  validate({ params: noteIdParam }),
  asyncHandler(controller.deleteOrganizationNote),
);

router.get('/users', validate({ query: listUsersQuerySchema }), asyncHandler(controller.listUsers));
router.patch(
  '/users/:id/status',
  validate({ params: userIdParam, body: updateUserStatusSchema }),
  asyncHandler(controller.updateUserStatus),
);

router.get('/leads', validate({ query: listLeadsQuerySchema }), asyncHandler(controller.listLeads));
router.get('/bookings', validate({ query: listBookingsQuerySchema }), asyncHandler(controller.listBookings));

// --- Finance (manual tracking) ---
router.get('/subscriptions', asyncHandler(controller.listSubscriptions));
router.put(
  '/subscriptions/:id',
  validate({ params: orgIdParam, body: upsertSubscriptionSchema }),
  asyncHandler(controller.upsertSubscription),
);
router.get('/expenses', validate({ query: financeQuerySchema }), asyncHandler(controller.listExpenses));
router.post('/expenses', validate({ body: createExpenseSchema }), asyncHandler(controller.createExpense));
router.delete('/expenses/:id', validate({ params: expenseIdParam }), asyncHandler(controller.deleteExpense));
router.get('/revenue', asyncHandler(controller.revenue));
router.get('/profit', validate({ query: financeQuerySchema }), asyncHandler(controller.profit));

// --- Ops ---
router.get('/system-health', asyncHandler(controller.systemHealth));

export default router;
