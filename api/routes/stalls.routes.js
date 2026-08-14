import { Router } from 'express';
import { getStalls, updateStallStatus, getStallMenu, addStallMenuItem } from '../controllers/stalls.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', getStalls);
router.put('/:id/status', requireAuth, requireRole('owner', 'admin'), updateStallStatus);
router.get('/:id/menu', getStallMenu);
router.post('/:id/menu', requireAuth, requireRole('owner', 'admin'), addStallMenuItem);

export default router;
