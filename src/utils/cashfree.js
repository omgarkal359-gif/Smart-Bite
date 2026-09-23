// =============================================================================
// Cashfree Drop-in checkout helper (client).
// Loads the Cashfree JS SDK on demand, asks our Edge Function for a payment
// session, and opens the hosted Drop-in modal. Payment status is confirmed
// separately by polling api.getPaymentStatus(orderId) — the webhook is the
// source of truth, never this modal's return value.
// =============================================================================
import { load } from '@cashfreepayments/cashfree-js';
import { api } from '../api';

// The SDK mode MUST match the environment the backend created the session in,
// otherwise Cashfree's widget shows "Something went wrong". The backend returns
// its environment as session.mode, so we always follow it (never a client env
// var, which can drift out of sync with the Edge Function's CASHFREE_ENV).
const _byMode = {};
async function getCashfree(mode) {
  const m = mode === 'production' ? 'production' : 'sandbox';
  if (_byMode[m]) return _byMode[m];
  _byMode[m] = await load({ mode: m });
  return _byMode[m];
}

// Creates the gateway session for an existing order and opens the Drop-in modal.
// Resolves once the modal closes (paid, failed, or dismissed). Confirm the real
// outcome by polling the order's payment status afterwards.
export async function openCashfreeCheckout(orderId) {
  const session = await api.createCashfreeSession(orderId);
  const cashfree = await getCashfree((session.mode || '').toLowerCase());
  if (!cashfree) throw new Error('Payment SDK unavailable in this environment.');

  const result = await cashfree.checkout({
    paymentSessionId: session.payment_session_id,
    redirectTarget: '_modal'
  });

  return { session, result };
}
