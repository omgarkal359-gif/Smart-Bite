// =============================================================================
// Edge Function: create-cashfree-order
// Authenticated student endpoint. Creates a Cashfree PG order for an EXISTING
// SmartBite order and returns the `payment_session_id` the browser SDK needs.
//
// Security:
//  - Caller must be signed in (JWT verified).
//  - The order must belong to the caller (orders.customer_id === auth uid).
//  - The charge amount is taken from orders.total in the DB (service role),
//    NEVER from the client — the browser cannot tamper the amount.
//  - Cashfree App ID / Secret live only here (server env), never in the client.
//
// Env (set via `supabase secrets set`):
//   CASHFREE_APP_ID, CASHFREE_SECRET_KEY, CASHFREE_ENV=sandbox|production,
//   APP_URL=https://<your-app-domain>   (for the return_url)
//
// Deploy: supabase functions deploy create-cashfree-order
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CF_APP_ID = Deno.env.get('CASHFREE_APP_ID') || '';
const CF_SECRET = Deno.env.get('CASHFREE_SECRET_KEY') || '';
const CF_ENV = (Deno.env.get('CASHFREE_ENV') || 'sandbox').toLowerCase();
const APP_URL = (Deno.env.get('APP_URL') || '').replace(/\/+$/, '');

const CF_BASE = CF_ENV === 'production'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg';
const CF_API_VERSION = '2023-08-01';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ success: false, message: 'POST only.' }, 405);

  if (!CF_APP_ID || !CF_SECRET) {
    return json({ success: false, message: 'Payment gateway not configured.' }, 503);
  }

  // ── Authenticate caller ───────────────────────────────────────────────────
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ success: false, message: 'Missing auth token.' }, 401);
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false }
  });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  const uid = userData?.user?.id || '';
  if (userErr || !uid) return json({ success: false, message: 'Invalid session.' }, 401);

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: any;
  try { body = await req.json(); } catch { return json({ success: false, message: 'Invalid JSON body.' }, 400); }
  const orderId = (body?.orderId || body?.order_id || '').toString().trim();
  if (!orderId) return json({ success: false, message: 'orderId is required.' }, 400);

  // ── Load the order (service role) and authorize ownership ─────────────────
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: order, error: oErr } = await admin
    .from('orders')
    .select('id, total, customer_id, customer_email, customer_name, payment_status')
    .eq('id', orderId)
    .maybeSingle();

  if (oErr) return json({ success: false, message: oErr.message }, 500);
  if (!order) return json({ success: false, message: 'Order not found.' }, 404);
  if (order.customer_id !== uid) return json({ success: false, message: 'This order does not belong to you.' }, 403);
  if ((order.payment_status || '').toLowerCase() === 'paid') {
    return json({ success: false, message: 'Order is already paid.' }, 409);
  }

  const amount = Number(order.total);
  if (!(amount > 0)) return json({ success: false, message: 'Invalid order amount.' }, 400);

  // Cashfree requires a customer phone. SmartBite does not collect one today, so
  // a sandbox-safe placeholder is used; replace with a real number when phone
  // capture is added at checkout.
  const phone = '9999999999';

  // ── Create the Cashfree order ─────────────────────────────────────────────
  const cfBody = {
    order_id: order.id,
    order_amount: amount,
    order_currency: 'INR',
    customer_details: {
      customer_id: uid,
      customer_phone: phone,
      customer_name: order.customer_name || 'Student',
      customer_email: order.customer_email || 'student@smartbite.in'
    },
    order_meta: {
      return_url: `${APP_URL || 'https://smartbite.local'}/student/order/${order.id}`,
      notify_url: `${SUPABASE_URL}/functions/v1/verify-payment-webhook`
    }
  };

  let cfRes: Response;
  try {
    cfRes = await fetch(`${CF_BASE}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': CF_API_VERSION,
        'x-client-id': CF_APP_ID,
        'x-client-secret': CF_SECRET,
        'x-idempotency-key': order.id
      },
      body: JSON.stringify(cfBody)
    });
  } catch (e) {
    return json({ success: false, message: 'Could not reach payment gateway.', detail: (e as Error).message }, 502);
  }

  const cf = await cfRes.json().catch(() => ({}));
  if (!cfRes.ok || !cf?.payment_session_id) {
    return json({ success: false, message: cf?.message || 'Gateway order creation failed.' }, 502);
  }

  // ── Record the payment attempt ────────────────────────────────────────────
  // payments.order_id is not unique, so update-else-insert (one row per order).
  try {
    const row = {
      gateway: 'cashfree',
      gateway_order_id: (cf.cf_order_id ?? '').toString(),
      amount,
      currency: 'INR',
      status: 'created'
    };
    const { data: existing } = await admin
      .from('payments').select('id').eq('order_id', order.id).maybeSingle();
    if (existing?.id) {
      await admin.from('payments').update(row).eq('id', existing.id);
    } else {
      await admin.from('payments').insert({ order_id: order.id, ...row });
    }
  } catch (_e) { /* non-fatal: webhook is the source of truth */ }

  return json({
    success: true,
    payment_session_id: cf.payment_session_id,
    cf_order_id: cf.cf_order_id,
    order_id: order.id,
    mode: CF_ENV
  });
});
