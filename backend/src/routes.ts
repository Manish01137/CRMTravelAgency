import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';
import orgRoutes from './modules/organizations/org.routes';
import usersRoutes from './modules/users/users.routes';
import leadsRoutes from './modules/leads/leads.routes';
import packagesRoutes from './modules/packages/packages.routes';
import bookingsRoutes from './modules/bookings/bookings.routes';
import tasksRoutes from './modules/tasks/tasks.routes';
import calendarRoutes from './modules/calendar/calendar.routes';
import invoicesRoutes from './modules/invoices/invoices.routes';
import billsRoutes from './modules/bills/bills.routes';
import hotelsRoutes from './modules/hotels/hotels.routes';
import sightseeingRoutes from './modules/sightseeing/sightseeing.routes';
import eventsRoutes from './modules/events/events.routes';
import linktreeCategoriesRoutes from './modules/linktree-categories/linktree-categories.routes';
import hostReviewsRoutes from './modules/host-reviews/host-reviews.routes';
import publicRoutes from './modules/public/public.routes';
import uploadsRoutes from './modules/uploads/uploads.routes';
import aiRoutes from './modules/ai/ai.routes';
// Phase 3 — Communication
import channelsRoutes from './modules/channels/channels.routes';
import webhooksRoutes from './modules/webhooks/webhooks.routes';
import inboxRoutes from './modules/inbox/inbox.routes';
import communicationsRoutes from './modules/communications/communications.routes';
import callLogRoutes from './modules/call-log/call-log.routes';
// Phase 4 — Automation & AI
import botFlowRoutes from './modules/bot-flow/bot-flow.routes';
import aiAgentRoutes from './modules/ai-agent/ai-agent.routes';
import automationRoutes from './modules/automation/automation.routes';
// Super Admin panel — platform owner only, entirely separate auth surface.
import platformAdminRoutes from './modules/platform-admin/platform-admin.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/organization', orgRoutes);
router.use('/users', usersRoutes);
router.use('/leads', leadsRoutes);
router.use('/packages', packagesRoutes);
router.use('/bookings', bookingsRoutes);
router.use('/tasks', tasksRoutes);
router.use('/calendar', calendarRoutes);
router.use('/invoices', invoicesRoutes);
router.use('/bills', billsRoutes);
router.use('/hotels', hotelsRoutes);
router.use('/sightseeing', sightseeingRoutes);
router.use('/events', eventsRoutes);
router.use('/linktree-categories', linktreeCategoriesRoutes);
router.use('/host-reviews', hostReviewsRoutes);
router.use('/public', publicRoutes);
router.use('/uploads', uploadsRoutes);
router.use('/ai', aiRoutes);
// Phase 3 — Communication
router.use('/channels', channelsRoutes);
router.use('/webhooks', webhooksRoutes);
router.use('/inbox', inboxRoutes);
router.use('/communications', communicationsRoutes);
router.use('/call-log', callLogRoutes);
// Phase 4 — Automation & AI
router.use('/bot-flows', botFlowRoutes);
router.use('/ai-agent', aiAgentRoutes);
router.use('/automation', automationRoutes);
// Super Admin panel
router.use('/platform-admin', platformAdminRoutes);

export default router;
