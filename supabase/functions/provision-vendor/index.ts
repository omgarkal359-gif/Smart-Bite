// =============================================================================
// Edge Function: provision-vendor
// Admin-only. Creates the vendor's Supabase Auth user (the login credential)
// and links accounts / stalls / vendors rows. Returns the temp password ONCE
// so the admin can hand it to the vendor.
//
// Why this exists: the browser cannot create auth users (needs the service-role
// key, which must never ship to the client). This function holds that key
// server-side and is the ONLY safe place to provision a login.
//
// Deploy:  supabase functions deploy provision-vendor
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

const BANK_KEYS = ['account_holder', 'account_number', 'ifsc', 'upi_id'];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

function slugify(s: string) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `stall-${Date.now()}`;
}

function tempPass() {
  // Must satisfy the project's password policy: upper + lower + digit, len >= 8.
  const b = new Uint8Array(5);
  crypto.getRandomValues(b);
  const hex = Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
  const digit = Math.floor(Math.random() * 10);
  return `Sb-${hex}${digit}`; // e.g. Sb-a1b2c3d4e57
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

  const email = (payload?.email || '').trim().toLowerCase();
  const data = payload?.data || {};
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return json({ success: false, message: 'A valid vendor email is required.' }, 400);
  }

  const stallId = payload?.stallId ? slugify(payload.stallId) : slugify(data.business_name || data.full_name || email.split('@')[0]);
  const fullName = data.full_name || email.split('@')[0];
  const password = tempPass();

  try {
    // ── 3. Create or refresh the auth user (the login credential) ────────────
    let userId: string | null = null;
    const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = listed?.users?.find((u) => (u.email || '').toLowerCase() === email);

    if (existing) {
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        app_metadata: { role: 'vendor', shopId: stallId },
        user_metadata: { ...existing.user_metadata, full_name: fullName, role: 'vendor' }
      });
    } else {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role: 'vendor', shopId: stallId },
        user_metadata: { full_name: fullName, role: 'vendor' }
      });
      if (cErr) return json({ success: false, message: `Auth user creation failed: ${cErr.message}` }, 500);
      userId = created.user!.id;
    }

    // ── 4. accounts (id MUST equal auth user id — login reads role by id) ─────
    await admin.from('accounts').upsert({
      id: userId, email, full_name: fullName, role: 'vendor', shop_id: stallId, account_status: 'ACTIVE'
    });

    // ── 5. stalls ─────────────────────────────────────────────────────────────
    await admin.from('stalls').upsert({
      id: stallId,
      name: data.business_name || fullName || stallId,
      category: data.category || 'Campus Stall',
      operating_hours: data.operating_hours || '08:00 AM - 08:00 PM',
      logo: data.logo || null,
      is_online: true, is_active: true, wait_time_minutes: 0,
      updated_at: new Date().toISOString()
    });

    // ── 6. vendors (bank keys kept OUT of the plaintext details blob) ─────────
    const safeDetails: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (!BANK_KEYS.includes(k)) safeDetails[k] = v;
    }
    const acctNo = (data.account_number || '').toString();
    await admin.from('vendors').upsert({
      stall_id: stallId,
      user_id: userId,
      business_name: data.business_name || fullName || stallId,
      owner_name: fullName,
      contact_email: email,
      vendor_status: 'ACTIVE',
      fssai: data.fssai || null,
      account_holder: data.account_holder || null,
      ifsc: data.ifsc || null,
      upi_id: data.upi_id || null,
      account_last4: acctNo ? acctNo.slice(-4) : null,
      details: safeDetails,
      updated_at: new Date().toISOString()
    }, { onConflict: 'stall_id' });

    // Link stall -> vendor row id.
    const { data: vRow } = await admin.from('vendors').select('id').eq('stall_id', stallId).maybeSingle();
    if (vRow?.id) await admin.from('stalls').update({ vendor_id: vRow.id }).eq('id', stallId);

    return json({ success: true, email, stallId, tempPassword: password, userId });
  } catch (e) {
    return json({ success: false, message: (e as Error).message || 'Provisioning failed.' }, 500);
  }
});
