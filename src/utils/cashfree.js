// =============================================================================
// Cashfree Drop-in checkout helper (client).
// Loads the Cashfree JS SDK on demand, asks our Edge Function for a payment
// session, and opens the hosted Drop-in modal. Payment status is confirmed
// separately by polling api.getPaymentStatus(orderId) — the webhook is the
// source of truth, never this modal's return value.
// =============================================================================
import { load } from '@cashfreepayments/cashfree-js';
import { api } from '../api';

// Sandbox by default; set VITE_CASHFREE_MODE=production for live payments.
const MODE = (import.meta.env.VITE_CASHFREE_MODE || 'sandbox').toLowerCase();

let _cashfree = null;
async function getCashfree() {
  if (_cashfree) return _cashfree;
  _cashfree = await load({ mode: MODE === 'production' ? 'production' : 'sandbox' });
  return _cashfree;
}

// Creates the gateway session for an existing order and opens the Drop-in modal.
// Resolves once the modal closes (paid, failed, or dismissed). Confirm the real
// outcome by polling the order's payment status afterwards.
export async function openCashfreeCheckout(orderId) {
  const session = await api.createCashfreeSession(orderId);
  const cashfree = await getCashfree();
  if (!cashfree) throw new Error('Payment SDK unavailable in this environment.');

  const result = await cashfree.checkout({
    paymentSessionId: session.payment_session_id,
    redirectTarget: '_modal'
  });

  return { session, result };
}
