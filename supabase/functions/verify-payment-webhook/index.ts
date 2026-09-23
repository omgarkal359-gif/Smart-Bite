// =============================================================================
// Edge Function: verify-payment-webhook  (Cashfree PG)
// Public endpoint Cashfree calls server-to-server after a payment. Verifies the
// webhook signature, then marks the SmartBite order paid/failed and records the
// payment. The browser is never trusted for payment status — this is the source
// of truth.
//
// Cashfree signature scheme:
//   signature = Base64( HMAC_SHA256( `${x-webhook-timestamp}${rawBody}`, secret ) )
//   secret    = your Cashfree Secret Key (CASHFREE_SECRET_KEY)
//   headers   = x-webhook-signature, x-webhook-timestamp
//
// Env (set via `supabase secrets set`):
//   CASHFREE_SECRET_KEY (preferred)  — same key used to create orders.
//   PAYMENT_WEBHOOK_SECRET           — optional fallback.
//
// Deploy: supabase functions deploy verify-payment-webhook --no-verify-jwt
// Point the Cashfree dashboard webhook at this function's URL.
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('CASHFREE_SECRET_KEY') || Deno.env.get('PAYMENT_WEBHOOK_SECRET') || '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function bytesToB64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

// Constant-time string compare to avoid signature timing leaks.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ success: false, message: 'POST only.' }, 405);

  // Fail closed if the secret is not configured — never accept unverified webhooks.
  if (!SECRET) return json({ success: false, message: 'Webhook secret not configured.' }, 503);

  const signature = req.headers.get('x-webhook-signature') || '';
  const timestamp = req.headers.get('x-webhook-timestamp') || '';
  if (!signature || !timestamp) return json({ success: false, message: 'Missing signature headers.' }, 400);

  // Verify against the RAW body bytes exactly as sent (must match what Cashfree signed).
  const rawBody = await req.text();
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(timestamp + rawBody));
  const expected = bytesToB64(mac);
  if (!timingSafeEqual(expected, signature)) {
    return json({ success: false, message: 'Signature verification failed.' }, 401);
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return json({ success: false, message: 'Invalid JSON body.' }, 400); }

  // Cashfree PAYMENT_*_WEBHOOK shape: { type, data: { order:{order_id}, payment:{...} } }
  const orderId = (payload?.data?.order?.order_id || payload?.data?.order_id || '').toString();
  const pay = payload?.data?.payment || {};
  const cfStatus = (pay?.payment_status || '').toString().toUpperCase();
  if (!orderId) return json({ success: false, message: 'order_id missing in payload.' }, 400);

  const paid = cfStatus === 'SUCCESS';
  const now = new Date().toISOString();
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  const { error: ordErr } = await admin.from('orders')
    .update({ payment_status: paid ? 'paid' : 'failed', updated_at: now })
    .eq('id', orderId);
  if (ordErr) return json({ success: false, message: ordErr.message }, 500);

  // Reveal the order to the vendor only now that payment cleared. Online orders
  // are created as 'awaiting_payment'; flip to 'placed' on success (or mark
  // 'payment_failed' on failure). Scope the transition to awaiting_payment so a
  // later/duplicate webhook can't clobber an order the vendor already advanced.
  try {
    await admin.from('orders')
      .update({ status: paid ? 'placed' : 'payment_failed', updated_at: now })
      .eq('id', orderId)
      .eq('status', 'awaiting_payment');
  } catch (_e) { /* non-fatal */ }

  // Best-effort payment record update (webhook already authoritative for order).
  try {
    const method = pay?.payment_group || (pay?.payment_method ? Object.keys(pay.payment_method)[0] : null);
    await admin.from('payments').update({
      status: paid ? 'paid' : 'failed',
      gateway_payment_id: (pay?.cf_payment_id ?? '').toString() || null,
      method: method || null,
      paid_at: paid ? now : null,
      failure_reason: paid ? null : (pay?.payment_message || cfStatus || null)
    }).eq('order_id', orderId);
  } catch (_e) { /* non-fatal */ }

  return json({ success: true, orderId, payment_status: paid ? 'paid' : 'failed' });
});
