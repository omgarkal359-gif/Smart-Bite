import { Router } from 'express';
import {
  createPaymentIntent,
  verifyPayment,
  cancelPayment,
  getPaymentStatus,
  handleWebhook
} from '../controllers/payments.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Payment Intent & Checkout Flow
router.post('/create-intent', requireAuth, createPaymentIntent);
router.post('/verify', requireAuth, verifyPayment);
router.post('/cancel', requireAuth, cancelPayment);
router.get('/:paymentId/status', requireAuth, getPaymentStatus);

// Webhook listener for payment providers (Razorpay / Cashfree / PhonePe / Bank Webhooks)
router.post('/webhook', handleWebhook);

export default router;
