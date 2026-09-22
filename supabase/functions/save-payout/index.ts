// =============================================================================
// Edge Function: save-payout
// Admin-only. Encrypts a vendor's bank account number (AES-256-GCM) with the
// server-held PAYOUT_ENCRYPTION_KEY and stores ONLY the ciphertext + last4 +
// non-secret fields (ifsc/upi/holder) on the vendors row. The raw account
// number never touches the database or the browser. Replaces the old Express
// /api/onboarding/payout trust layer.
//
// Deploy:  supabase functions deploy save-payout
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY are
//          injected by the platform. Set PAYOUT_ENCRYPTION_KEY yourself:
//            supabase secrets set PAYOUT_ENCRYPTION_KEY=<stable-random-secret>
//          Keep it STABLE — rotating it makes existing ciphertext undecryptable.
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const PAYOUT_KEY = Deno.env.get('PAYOUT_ENCRYPTION_KEY') || '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const last4 = (s: string) => String(s || '').replace(/\s/g, '').slice(-4);

// AES-256-GCM. Key = sha256(PAYOUT_ENCRYPTION_KEY) so any-length secret works.
// Wire format "iv:tag:ciphertext" (all base64) matches the prior Express impl.
async function encryptAccount(plain: string): Promise<string> {
  if (!PAYOUT_KEY) throw new Error('PAYOUT_ENCRYPTION_KEY is not configured on the server.');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(PAYOUT_KEY));
  const key = await crypto.subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const full = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(String(plain)))
  );
  // Web Crypto appends the 16-byte GCM auth tag to the ciphertext; split it out.
  const tag = full.slice(full.length - 16);
  const ct = full.slice(0, full.length - 16);
  return `${b64(iv)}:${b64(tag)}:${b64(ct)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ success: false, message: 'POST only.' }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // ── 1. Authenticate + authorize the caller (must be an admin) ──────────────
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ success: false, message: 'Missing auth token.' }, 401);

  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false }
  });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  const callerEmail = (userData?.user?.email || '').toLowerCase();
  if (userErr || !callerEmail) return json({ success: false, message: 'Invalid session.' }, 401);

  const { data: allow } = await admin.from('admin_allowlist').select('email').eq('email', callerEmail).maybeSingle();
  const { data: acct } = await admin.from('accounts').select('role').eq('id', userData!.user!.id).maybeSingle();
  if (!allow && acct?.role !== 'admin') return json({ success: false, message: 'Admin access required.' }, 403);

  // ── 2. Parse input ─────────────────────────────────────────────────────────
  let payload: any;
  try { payload = await req.json(); } catch { return json({ success: false, message: 'Invalid JSON body.' }, 400); }

  const stallId = (payload?.stallId || '').toString().trim();
  if (!stallId) return json({ success: false, message: 'stallId is required.' }, 400);

  const account_holder = payload?.account_holder;
  const account_number = (payload?.account_number || '').toString().trim();
  const ifsc = payload?.ifsc;
  const upi_id = payload?.upi_id;

  // ── 3. Build the patch (never persist the raw account number) ───────────────
  try {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (account_holder !== undefined) patch.account_holder = account_holder || null;
    if (ifsc !== undefined) patch.ifsc = ifsc || null;
    if (upi_id !== undefined) patch.upi_id = upi_id || null;

    if (account_number) {
      patch.account_number_enc = await encryptAccount(account_number);
      patch.account_last4 = last4(account_number);
    }

    // Payout-provider registration (Cashfree) is a TODO — no gateway wired yet.
    // Mark 'registered' once bank/UPI details are stored so the admin UI reflects
    // that payout data is on file; swap for a real registerVendor call later.
    if (account_number || upi_id) patch.payout_status = 'registered';

    const { error } = await admin.from('vendors').update(patch).eq('stall_id', stallId);
    if (error) return json({ success: false, message: error.message }, 500);

    return json({
      success: true,
      last4: (patch.account_last4 as string) || null,
      payout_status: (patch.payout_status as string) || 'pending'
    });
  } catch (e) {
    return json({ success: false, message: (e as Error).message || 'Payout save failed.' }, 500);
  }
});
