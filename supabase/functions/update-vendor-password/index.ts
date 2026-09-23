// =============================================================================
// Edge Function: update-vendor-password
// Admin-only. Sets a vendor's Supabase Auth password (bcrypt-hashed by Supabase)
// using the service-role key. Passwords are NEVER stored in plaintext in the
// database or localStorage, and are never returned in the response.
//
// Deploy:  supabase functions deploy update-vendor-password
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

  // ── 2. Parse + validate input ──────────────────────────────────────────────
  let payload: any;
  try { payload = await req.json(); } catch { return json({ success: false, message: 'Invalid JSON body.' }, 400); }

  const email = (payload?.email || '').trim().toLowerCase();
  const password = (payload?.password || '').toString();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return json({ success: false, message: 'A valid vendor email is required.' }, 400);
  }
  // Reject SQL LIKE wildcards so the ilike match can't span multiple accounts.
  if (/[%_\\]/.test(email)) {
    return json({ success: false, message: 'Invalid vendor email.' }, 400);
  }
  if (password.length < 8) {
    return json({ success: false, message: 'Password must be at least 8 characters.' }, 400);
  }

  // ── 3. Find the auth user and update the (hashed) password ──────────────────
  try {
    const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = listed?.users?.find((u) => (u.email || '').toLowerCase() === email);
    if (!existing) {
      return json({ success: false, message: 'No auth user for that email. Provision the vendor first.' }, 404);
    }

    const { error: uErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true
    });
    if (uErr) return json({ success: false, message: `Password update failed: ${uErr.message}` }, 500);

    // Record the rotation time only (no plaintext password persisted).
    await admin.from('vendors')
      .update({ updated_at: new Date().toISOString() })
      .ilike('contact_email', email);

    return json({ success: true, message: 'Password updated.' });
  } catch (e) {
    return json({ success: false, message: (e as Error).message || 'Update failed.' }, 500);
  }
});
