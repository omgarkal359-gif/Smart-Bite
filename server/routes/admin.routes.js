import { Router } from 'express';
import { getMetrics, getUsers } from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/metrics', requireAuth, requireRole('admin'), getMetrics);
router.get('/users', requireAuth, requireRole('admin'), getUsers);

export default router;
