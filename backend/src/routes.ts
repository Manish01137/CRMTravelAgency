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
import publicRoutes from './modules/public/public.routes';

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
router.use('/public', publicRoutes);

export default router;
