import crypto from 'crypto';
import { PaymentProviderInterface } from './PaymentProviderInterface.js';

export class MockPaymentProvider extends PaymentProviderInterface {
  /**
   * Initializes the mock provider with a webhook secret.
   * @param {string} secret 
   */
  constructor(secret = 'sgu_payment_webhook_secret_key_2026') {
    super();
    this.secret = secret;
  }

  /**
   * Creates a mock payment and generates a unique payment ID.
   */
  async createPayment(orderId, amountPaise, currency = 'INR') {
    const paymentId = `PAY-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    return {
      paymentId,
      checkoutUrl: `upi://pay?pa=sgu_foodcourt@bank&am=${(amountPaise / 100).toFixed(2)}&tr=${paymentId}`
    };
  }

  /**
   * Mock payment verification.
   */
  async verifyPayment(paymentId) {
    return {
      success: true,
      status: 'success',
      amountPaise: 5000,
      currency: 'INR'
    };
  }

  /**
   * Initiates a mock settlement transfer to a vendor account.
   */
  async createSettlement(transferPayload) {
    const transferId = `TXF-MOCK-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    return {
      success: true,
      providerTransferId: transferId,
      status: 'completed' // In mock development, complete it immediately
    };
  }

  /**
   * Queries status of mock settlement.
   */
  async getSettlementStatus(transferId) {
    return {
      success: true,
      status: 'completed',
      settledAt: new Date().toISOString()
    };
  }

  /**
   * Request a mock payment refund.
   */
  async refundPayment(paymentId, amountPaise) {
    const refundId = `REF-MOCK-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    return {
      success: true,
      refundId,
      status: 'refunded'
    };
  }

  /**
   * Verifies the HMAC-SHA256 signature of a webhook payload.
   */
  async verifyWebhook(payload, headers) {
    const signature = headers['x-provider-signature'];
    if (!signature) {
      return { success: false, error: 'Signature header missing.' };
    }

    const payloadString = JSON.stringify(payload);
    const computedSignature = crypto
      .createHmac('sha256', this.secret)
      .update(payloadString)
      .digest('hex');

    if (signature !== computedSignature) {
      return { success: false, error: 'Signature verification failed.' };
    }

    // Support both amount and amountPaise for compatibility
    let amountPaise = payload.amountPaise;
    if (amountPaise === undefined && payload.amount !== undefined) {
      amountPaise = Math.round(Number(payload.amount) * 100);
    }

    return {
      success: true,
      paymentId: payload.paymentId,
      providerPaymentId: payload.providerPaymentId,
      amountPaise: amountPaise,
      currency: payload.currency || 'INR',
      status: payload.status,
      // For settlement webhooks
      providerTransferId: payload.providerTransferId,
      stallId: payload.stallId
    };
  }

  /**
   * Generates a valid signature for simulated webhooks in development/test.
   * @param {object} payload 
   * @returns {string} HMAC hex digest
   */
  generateSignature(payload) {
    const payloadString = JSON.stringify(payload);
    return crypto
      .createHmac('sha256', this.secret)
      .update(payloadString)
      .digest('hex');
  }
}
