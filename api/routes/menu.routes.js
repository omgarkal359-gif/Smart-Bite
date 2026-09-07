import { Router } from 'express';
import { updateMenuItem, deleteMenuItem } from '../controllers/menu.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.put('/:itemId', requireAuth, requireRole('owner', 'admin'), updateMenuItem);
router.delete('/:itemId', requireAuth, requireRole('owner', 'admin'), deleteMenuItem);

export default router;
