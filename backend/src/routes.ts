import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes';
import orgRoutes from './modules/organizations/org.routes';
import usersRoutes from './modules/users/users.routes';
import leadsRoutes from './modules/leads/leads.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/organization', orgRoutes);
router.use('/users', usersRoutes);
router.use('/leads', leadsRoutes);

export default router;
