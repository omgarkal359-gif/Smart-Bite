import { Router } from 'express';
import {
  createInvite, listInvites, getInvite, submitOnboarding, approveInvite, rejectInvite, manualCreate, updatePayout
} from '../controllers/onboarding.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// ── Public (token-gated) ──
router.get('/:token', getInvite);
router.post('/:token/submit', submitOnboarding);

// ── Admin ──
router.get('/', requireAuth, requireRole('admin'), listInvites);
router.post('/invite', requireAuth, requireRole('admin'), createInvite);
router.post('/manual', requireAuth, requireRole('admin'), manualCreate);
router.post('/payout', requireAuth, requireRole('admin'), updatePayout);
router.post('/:id/approve', requireAuth, requireRole('admin'), approveInvite);
router.post('/:id/reject', requireAuth, requireRole('admin'), rejectInvite);

export default router;
