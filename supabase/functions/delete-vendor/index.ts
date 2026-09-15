// =============================================================================
// Edge Function: delete-vendor
// Admin-only. Permanently removes a vendor/stall and its linked rows using the
// service-role key (server-side only). The browser must NOT issue these deletes
// with the anon key — RLS + this gate are the authorization boundary.
//
// Deploy:  supabase functions deploy delete-vendor
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY are
//          injected automatically by the platform.
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ success: false, message: 'POST only.' }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // ── 1. Authenticate + authorize the caller (must be an admin) ──────────────
  const authHeader = req.headers.get('Authorization') || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
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
  const isAdmin = !!allow || acct?.role === 'admin';
  if (!isAdmin) return json({ success: false, message: 'Admin access required.' }, 403);

  // ── 2. Parse input ─────────────────────────────────────────────────────────
  let payload: any;
  try { payload = await req.json(); } catch { return json({ success: false, message: 'Invalid JSON body.' }, 400); }

  const stallId = String(payload?.stallId || '').trim();
  if (!stallId) return json({ success: false, message: 'stallId is required.' }, 400);

  // ── 3. Look up linked email, then delete across tables (service role) ───────
  try {
    let vendorEmail: string | null = null;
    const { data: vRec } = await admin.from('vendors').select('contact_email').eq('stall_id', stallId).maybeSingle();
    if (vRec?.contact_email) vendorEmail = vRec.contact_email.toLowerCase();

    await admin.from('menu_items').delete().eq('stall_id', stallId);
    await admin.from('vendor_invites').delete().eq('stall_id', stallId);
    await admin.from('vendors').delete().eq('stall_id', stallId);
    await admin.from('accounts').delete().eq('shop_id', stallId);
    await admin.from('stalls').delete().eq('id', stallId);

    if (vendorEmail) {
      await admin.from('vendors').delete().ilike('contact_email', vendorEmail);
      await admin.from('accounts').delete().ilike('email', vendorEmail);
      await admin.from('vendor_invites').delete().ilike('contact_email', vendorEmail);
    }

    return json({ success: true, message: `Vendor "${stallId}" deleted.`, stallId });
  } catch (e) {
    return json({ success: false, message: (e as Error).message || 'Delete failed.' }, 500);
  }
});
