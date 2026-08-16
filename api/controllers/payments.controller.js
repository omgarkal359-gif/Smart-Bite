import { PaymentVerificationService } from '../services/PaymentVerificationService.js';

export async function createPaymentIntent(req, res) {
  try {
    const { items, type, paymentMethod, idempotencyKey, orderId } = req.body;
    const reqUser = req.user || {};
    const customerId = reqUser.id || req.body.customerId || '9876543210';
    const customerName = reqUser.name || req.body.customerName || 'Student';

    const result = await PaymentVerificationService.createPaymentIntent({
      customerId,
      customerName,
      type,
      items,
      paymentMethod,
      idempotencyKey,
      customOrderId: orderId
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Error creating payment intent:', err);
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function verifyPayment(req, res) {
  try {
    const { paymentId, orderId, transactionRef } = req.body;
    const io = req.app.get('io');
    const reqUser = req.user;

    const result = await PaymentVerificationService.verifyPayment({
      paymentId,
      orderId,
      transactionRef,
      reqUser,
      io
    });

    res.json(result);
  } catch (err) {
    console.error('Payment verification error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function cancelPayment(req, res) {
  try {
    const { paymentId, orderId, reason } = req.body;
    const reqUser = req.user;

    const result = await PaymentVerificationService.cancelPayment({
      paymentId,
      orderId,
      reason,
      reqUser
    });

    res.json(result);
  } catch (err) {
    console.error('Payment cancellation error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function getPaymentStatus(req, res) {
  try {
    const { paymentId } = req.params;
    const result = await PaymentVerificationService.getPaymentStatus(paymentId);
    res.json(result);
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
}

export async function handleWebhook(req, res) {
  try {
    const io = req.app.get('io');
    const { event, data } = req.body || {};

    if (event === 'payment.captured' || event === 'payment.success') {
      const orderId = data?.orderId || data?.order_id || data?.notes?.orderId;
      const paymentId = data?.paymentId || data?.id;
      const transactionRef = data?.transactionRef || data?.utr || data?.acquirer_data?.rrn || data?.id;

      if (orderId && transactionRef) {
        await PaymentVerificationService.verifyPayment({
          paymentId,
          orderId,
          transactionRef,
          io
        });
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
}
