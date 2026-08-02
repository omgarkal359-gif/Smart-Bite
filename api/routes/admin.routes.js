import { Router } from 'express';
import { getMetrics } from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/metrics', requireAuth, requireRole('admin'), getMetrics);

export default router;
