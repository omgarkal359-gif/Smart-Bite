import { Router } from 'express';
import { updateMenuItem } from '../controllers/menu.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.put('/:itemId', requireAuth, requireRole('owner', 'admin'), updateMenuItem);

export default router;
