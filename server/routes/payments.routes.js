import { Router } from 'express';
import { 
  getPaymentStatus, 
  webhookHandler, 
  webhookPaymentHandler, 
  webhookSettlementHandler, 
  simulatePayment,
  reconcilePaymentsAndSettlements
} from '../controllers/payments.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Webhooks: public callback endpoints verified strictly via signature verification
router.post('/webhook/payment', webhookPaymentHandler);
router.post('/webhook/settlement', webhookSettlementHandler);
router.post('/webhook', webhookHandler); // legacy compatibility route

// Reconciliation Endpoint (requires server-to-server header authorization)
router.post('/reconcile', reconcilePaymentsAndSettlements);

// Payment status check (requires student authentication)
router.get('/:paymentId/status', requireAuth, getPaymentStatus);

// Payment simulator (development only, strictly disabled in production)
router.post('/simulate', requireAuth, simulatePayment);

export default router;
