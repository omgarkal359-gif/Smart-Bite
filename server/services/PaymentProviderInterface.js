/**
 * Abstract Payment Provider Interface.
 * Any payment gateway integration (Stripe, Razorpay, Mock UPI) must extend this class
 * and implement its methods to allow swapping payment gateways without changing the order system.
 */
export class PaymentProviderInterface {
  /**
   * Create a payment request with the provider.
   * @param {string} orderId - Local order ID
   * @param {number} amountPaise - Amount to charge (in minor units/paise)
   * @param {string} currency - Currency code (e.g. 'INR')
   * @returns {Promise<{paymentId: string, checkoutUrl?: string, additionalData?: any}>}
   */
  async createPayment(orderId, amountPaise, currency) {
    throw new Error('Method not implemented.');
  }

  /**
   * Verify the authenticity of a payment directly with the provider.
   * @param {string} paymentId - Local payment ID
   * @returns {Promise<{success: boolean, status: string, amountPaise: number, currency: string}>}
   */
  async verifyPayment(paymentId) {
    throw new Error('Method not implemented.');
  }

  /**
   * Create/initiate a settlement transfer to a vendor account.
   * @param {object} transferPayload - The transfer details containing vendor account, amount in paise, etc.
   * @returns {Promise<{success: boolean, providerTransferId: string, status: string, error?: string}>}
   */
  async createSettlement(transferPayload) {
    throw new Error('Method not implemented.');
  }

  /**
   * Query the status of a settlement/transfer from the provider.
   * @param {string} transferId - The transfer reference ID
   * @returns {Promise<{success: boolean, status: string, settledAt?: string, error?: string}>}
   */
  async getSettlementStatus(transferId) {
    throw new Error('Method not implemented.');
  }

  /**
   * Request a payment refund.
   * @param {string} paymentId - Local payment ID
   * @param {number} amountPaise - Amount to refund (in paise)
   * @returns {Promise<{success: boolean, refundId?: string, status: string, error?: string}>}
   */
  async refundPayment(paymentId, amountPaise) {
    throw new Error('Method not implemented.');
  }

  /**
   * Verify the authenticity of a webhook request from the payment provider.
   * @param {object} payload - The request body/payload from the provider
   * @param {object} headers - HTTP headers received with the webhook request
   * @returns {Promise<{success: boolean, paymentId: string, providerPaymentId: string, amountPaise: number, currency: string, status: string, error?: string}>}
   */
  async verifyWebhook(payload, headers) {
    throw new Error('Method not implemented.');
  }

  // --- BACKWARD COMPATIBILITY WRAPPERS ---
  
  async createPaymentSession(orderId, amount, currency = 'INR') {
    const amountPaise = Math.round(amount * 100);
    return this.createPayment(orderId, amountPaise, currency);
  }

  async fetchPaymentDetails(providerPaymentId) {
    return this.getSettlementStatus(providerPaymentId);
  }
}
