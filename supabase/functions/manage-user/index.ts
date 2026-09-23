// =============================================================================
// Edge Function: manage-user
// Admin-only. Real user management over accounts + auth.users using the
// service-role key. Replaces the fake localStorage/seed-array UserDirectory.
//
// Actions (POST body { action, ... }):
//   { action: 'set-role',   email, role }                  -> change accounts.role (+ auth metadata)
//   { action: 'set-status', email, status }                -> ACTIVE | SUSPENDED (bans/unbans auth user)
//   { action: 'delete',     email }                        -> remove auth user + accounts row
//   { action: 'create',     email, role, shopId?, fullName?} -> create auth user + accounts row, returns temp password
//
// Roles: 'student' | 'vendor' | 'admin'. 'vendor' requires shopId.
//
// Deploy: supabase functions deploy manage-user
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
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const VALID_ROLES = ['student', 'vendor', 'admin'];

async function findUserByEmail(admin: any, email: string) {
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return listed?.users?.find((u: any) => (u.email || '').toLowerCase() === email) || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ success: false, message: 'POST only.' }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // ── 1. Authenticate + authorize caller (admin only) ────────────────────────
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ success: false, message: 'Missing auth token.' }, 401);
  const caller = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false }
  });
  const { data: userData, error: userErr } = await caller.auth.getUser();
  const callerEmail = (userData?.user?.email || '').toLowerCase();
  if (userErr || !callerEmail) return json({ success: false, message: 'Invalid session.' }, 401);
  const { data: allow } = await admin.from('admin_allowlist').select('email').eq('email', callerEmail).maybeSingle();
  const { data: acct } = await admin.from('accounts').select('role').eq('id', userData!.user!.id).maybeSingle();
  if (!allow && acct?.role !== 'admin') return json({ success: false, message: 'Admin access required.' }, 403);

  // ── 2. Parse input ─────────────────────────────────────────────────────────
  let p: any;
  try { p = await req.json(); } catch { return json({ success: false, message: 'Invalid JSON body.' }, 400); }
  const action = (p?.action || '').toString();
  const email = (p?.email || '').toString().trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json({ success: false, message: 'A valid email is required.' }, 400);
  // Reject SQL LIKE wildcards so an email can never match multiple rows.
  if (/[%_\\]/.test(email)) return json({ success: false, message: 'Invalid email.' }, 400);

  // Guard: never let an admin lock themselves out.
  const selfTarget = email === callerEmail;

  try {
    if (action === 'set-role') {
      const role = (p?.role || '').toString();
      if (!VALID_ROLES.includes(role)) return json({ success: false, message: 'Invalid role.' }, 400);
      if (selfTarget && role !== 'admin') return json({ success: false, message: 'You cannot remove your own admin role.' }, 400);
      const shopId = role === 'vendor' ? (p?.shopId || null) : null;
      if (role === 'vendor' && !shopId) return json({ success: false, message: 'A stall is required for the vendor role.' }, 400);

      const existing = await findUserByEmail(admin, email);
      if (existing) {
        await admin.auth.admin.updateUserById(existing.id, {
          app_metadata: { role, shopId },
          user_metadata: { ...(existing.user_metadata || {}), role }
        });
      }
      const { error } = await admin.from('accounts')
        .update({ role, shop_id: shopId }).eq('email', email);
      if (error) return json({ success: false, message: error.message }, 500);
      return json({ success: true, email, role });
    }

    if (action === 'set-status') {
      const status = (p?.status || '').toString().toUpperCase();
      if (!['ACTIVE', 'SUSPENDED'].includes(status)) return json({ success: false, message: 'Invalid status.' }, 400);
      if (selfTarget && status === 'SUSPENDED') return json({ success: false, message: 'You cannot suspend your own account.' }, 400);
      const existing = await findUserByEmail(admin, email);
      if (existing) {
        // Ban (indefinitely) or unban the auth user so the change is enforced.
        await admin.auth.admin.updateUserById(existing.id, { ban_duration: status === 'SUSPENDED' ? '876000h' : 'none' });
      }
      const { error } = await admin.from('accounts').update({ account_status: status }).eq('email', email);
      if (error) return json({ success: false, message: error.message }, 500);
      return json({ success: true, email, status });
    }

    if (action === 'delete') {
      if (selfTarget) return json({ success: false, message: 'You cannot delete your own account.' }, 400);
      const existing = await findUserByEmail(admin, email);
      if (existing) await admin.auth.admin.deleteUser(existing.id);
      await admin.from('accounts').delete().eq('email', email);
      return json({ success: true, email, deleted: true });
    }

    if (action === 'create') {
      const role = (p?.role || 'student').toString();
      if (!VALID_ROLES.includes(role)) return json({ success: false, message: 'Invalid role.' }, 400);
      const shopId = role === 'vendor' ? (p?.shopId || null) : null;
      if (role === 'vendor' && !shopId) return json({ success: false, message: 'A stall is required for the vendor role.' }, 400);
      const fullName = (p?.fullName || email.split('@')[0]).toString();

      if (await findUserByEmail(admin, email)) return json({ success: false, message: 'A user with that email already exists.' }, 409);

      // Strong temp password: 24 random bytes (192 bits) base64url-ish.
      const _pwBuf = crypto.getRandomValues(new Uint8Array(24));
      const tempPassword = 'Sb-' + btoa(String.fromCharCode(..._pwBuf)).replace(/[+/=]/g, '').slice(0, 20);
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password: tempPassword, email_confirm: true,
        app_metadata: { role, shopId }, user_metadata: { full_name: fullName, role }
      });
      if (cErr || !created?.user) return json({ success: false, message: cErr?.message || 'User creation failed.' }, 500);

      const { error } = await admin.from('accounts').upsert({
        id: created.user.id, email, full_name: fullName, role, shop_id: shopId, account_status: 'ACTIVE'
      });
      if (error) return json({ success: false, message: error.message }, 500);
      return json({ success: true, email, role, tempPassword });
    }

    return json({ success: false, message: `Unknown action "${action}".` }, 400);
  } catch (e) {
    return json({ success: false, message: (e as Error).message || 'User management failed.' }, 500);
  }
});
