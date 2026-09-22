// =============================================================================
// Edge Function: verify-payment-webhook
// Public endpoint the PAYMENT GATEWAY calls (not the browser, not a logged-in
// user). Verifies the HMAC-SHA256 signature of the webhook with the server-held
// PAYMENT_WEBHOOK_SECRET using a CONSTANT-TIME comparison (crypto.subtle.verify),
// then marks the order paid. Replaces the dead Express MockPaymentProvider
// webhook path, and fixes its timing-unsafe `!==` string compare.
//
// NOTE: payments are still mocked client-side today; this function exists so the
// server-side verification is ready when a real gateway (Cashfree) is wired.
// Point the gateway's webhook at this URL and send the signature header.
//
// Deploy: supabase functions deploy verify-payment-webhook --no-verify-jwt
// Secret: supabase secrets set PAYMENT_WEBHOOK_SECRET=<gateway-webhook-secret>
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('PAYMENT_WEBHOOK_SECRET') || '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature, x-provider-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

// Decode a base64 signature to bytes; return null on malformed input.
function b64ToBytes(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ success: false, message: 'POST only.' }, 405);

  // Fail closed if the secret is not configured — never accept unverified webhooks.
  if (!WEBHOOK_SECRET) return json({ success: false, message: 'Webhook secret not configured.' }, 503);

  const signature = req.headers.get('x-webhook-signature') || req.headers.get('x-provider-signature') || '';
  if (!signature) return json({ success: false, message: 'Signature header missing.' }, 400);

  // Verify against the RAW body bytes (must match what the gateway signed).
  const rawBody = await req.text();
  const sigBytes = b64ToBytes(signature);
  if (!sigBytes) return json({ success: false, message: 'Malformed signature.' }, 400);

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  // crypto.subtle.verify is constant-time for HMAC.
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(rawBody));
  if (!valid) return json({ success: false, message: 'Signature verification failed.' }, 401);

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return json({ success: false, message: 'Invalid JSON body.' }, 400); }

  const orderId = (payload?.orderId || payload?.order_id || payload?.paymentId || '').toString();
  if (!orderId) return json({ success: false, message: 'orderId missing in payload.' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const paid = (payload?.status || '').toString().toLowerCase() === 'success' || payload?.paid === true;

  const { error } = await admin.from('orders')
    .update({ payment_status: paid ? 'paid' : 'failed', updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) return json({ success: false, message: error.message }, 500);

  return json({ success: true, orderId, payment_status: paid ? 'paid' : 'failed' });
});
