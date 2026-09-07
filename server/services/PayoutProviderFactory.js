import { config } from '../config.js';
import logger from '../utils/logger.js';

// A payout provider registers a vendor's bank account for settlements and
// returns a provider vendor id. Swap Mock -> Cashfree by setting CASHFREE_* env.
//
// Contract: registerVendor({ stallId, name, email, phone, accountHolder,
//   accountNumber, ifsc, upiId }) -> { vendorId, status }

class MockPayoutProvider {
  get name() { return 'mock'; }
  async registerVendor({ stallId }) {
    return { vendorId: `mock_vendor_${stallId}_${Date.now().toString(36)}`, status: 'registered' };
  }
}

class CashfreePayoutProvider {
  constructor() {
    this.appId = config.CASHFREE_APP_ID;
    this.secret = config.CASHFREE_SECRET_KEY;
    this.env = config.CASHFREE_ENV; // 'sandbox' | 'production'
  }
  get name() { return 'cashfree'; }
  get configured() { return !!(this.appId && this.secret); }

  async registerVendor(vendor) {
    if (!this.configured) {
      throw new Error('Cashfree is not configured (set CASHFREE_APP_ID / CASHFREE_SECRET_KEY).');
    }
    // TODO (when going live): call Cashfree Easy Split "Create Vendor" API here,
    // https://{sandbox|api}.cashfree.com/pg/easy-split/vendors, with x-client-id /
    // x-client-secret headers, body { vendor_id, name, email, phone, bank:{...} | upi:{...} }.
    // Return { vendorId: resp.vendor_id, status: resp.status }.
    const base = this.env === 'production' ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com';
    logger.info(`[PAYOUT] Cashfree registerVendor stub (${base}) — implement live call before production.`);
    throw new Error('Cashfree payout registration not implemented yet. Add the API call in CashfreePayoutProvider.');
  }
}

let provider = null;
export function getPayoutProvider() {
  if (provider) return provider;
  provider = config.PAYOUT_PROVIDER === 'cashfree' ? new CashfreePayoutProvider() : new MockPayoutProvider();
  return provider;
}
