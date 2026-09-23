// =============================================================================
// Edge Function: export-data
// Admin-only. Returns a full JSON snapshot of core tables using the service-role
// key (bypasses RLS so the export is complete). Read-only — never mutates data.
//
// Response: { success, generatedAt, counts: { table: n }, tables: { table: [rows] } }
//
// Deploy: supabase functions deploy export-data
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

// Tables included in the export. Order chosen so a human reading the file sees
// identities first, then transactional data, then the audit trail.
const EXPORT_TABLES = [
  'accounts',
  'stalls',
  'menu_categories',
  'menu_items',
  'vendors',
  'orders',
  'order_items',
  'menu_change_requests',
  'audit_logs',
  'platform_config'
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ success: false, message: 'POST only.' }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // ── Authenticate + authorize caller (admin only) ──────────────────────────
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

  // ── Dump each table (service-role, read-only) ─────────────────────────────
  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  try {
    for (const t of EXPORT_TABLES) {
      const { data, error } = await admin.from(t).select('*');
      if (error) { tables[t] = []; counts[t] = 0; continue; }
      tables[t] = data || [];
      counts[t] = (data || []).length;
    }
    return json({ success: true, generatedAt: new Date().toISOString(), counts, tables });
  } catch (e) {
    return json({ success: false, message: (e as Error).message || 'Export failed.' }, 500);
  }
});
