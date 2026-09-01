import { config } from '../config.js';
import { MockPaymentProvider } from './MockPaymentProvider.js';

let providerInstance = null;

/**
 * Returns the configured payment provider instance, checking environment safety constraints.
 * @returns {PaymentProviderInterface}
 */
export function getPaymentProvider() {
  if (providerInstance) {
    return providerInstance;
  }

  const providerType = (config.PAYMENT_PROVIDER || 'mock').trim().toLowerCase();

  if (providerType === 'mock') {
    if (config.NODE_ENV === 'production') {
      throw new Error('Security Violation: MockPaymentProvider cannot be used in a production environment.');
    }
    providerInstance = new MockPaymentProvider();
  } else {
    throw new Error(`Payment provider "${config.PAYMENT_PROVIDER}" is not yet implemented.`);
  }

  return providerInstance;
}
