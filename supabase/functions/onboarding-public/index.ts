// =============================================================================
// Edge Function: onboarding-public
// Public (no login). Drives the token-based vendor onboarding form at
// /onboard/:token. Uses the service-role key so the anon visitor never needs
// direct RLS access to vendor_invites — the unguessable token is the capability.
// Replaces the old Express GET /onboarding/:token and POST /:token/submit.
//
// Actions (POST body):
//   { action: 'get',    token }               -> invite details + required fields
//   { action: 'submit', token, data: {...} }  -> store submitted_data, mark submitted
//
// Deploy: supabase functions deploy onboarding-public --no-verify-jwt
//   (--no-verify-jwt because onboarding visitors are unauthenticated.)
// =============================================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

// Canonical field catalogue (mirrors src/api.js DEFAULT_FIELD_CATALOG).
const FIELD_CATALOG = [
  { key: 'full_name',       label: 'Full Name',             group: 'core' },
  { key: 'mobile',          label: 'Mobile Number',         group: 'core' },
  { key: 'business_name',   label: 'Business / Stall Name', group: 'core' },
  { key: 'account_holder',  label: 'Account Holder Name',   group: 'bank' },
  { key: 'account_number',  label: 'Bank Account Number',   group: 'bank' },
  { key: 'ifsc',            label: 'IFSC Code',             group: 'bank' },
  { key: 'upi_id',          label: 'UPI ID',                group: 'bank' },
  { key: 'fssai',           label: 'FSSAI License No.',     group: 'compliance' },
  { key: 'pan',             label: 'PAN',                   group: 'compliance' },
  { key: 'gstin',           label: 'GSTIN',                 group: 'compliance' },
  { key: 'address',         label: 'Address',              group: 'compliance' },
  { key: 'category',        label: 'Stall Category',        group: 'stall' },
  { key: 'operating_hours', label: 'Operating Hours',       group: 'stall' },
  { key: 'logo',            label: 'Logo (emoji or URL)',   group: 'stall' }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ success: false, message: 'POST only.' }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  let payload: any;
  try { payload = await req.json(); } catch { return json({ success: false, message: 'Invalid JSON body.' }, 400); }

  const action = (payload?.action || '').toString();
  const token = (payload?.token || '').toString().trim();
  if (!token) return json({ success: false, message: 'A token is required.' }, 400);

  try {
    // ── get: fetch invite by token for the onboarding form ────────────────────
    if (action === 'get') {
      const { data, error } = await admin.from('vendor_invites')
        .select('contact_email, invitee_name, required_fields, status')
        .eq('token', token).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return json({ success: false, message: 'Invite not found.' }, 404);
      if (data.status === 'approved') return json({ success: false, message: 'This onboarding is already complete.' }, 410);
      if (data.status === 'rejected') return json({ success: false, message: 'This invite is no longer valid.' }, 410);

      const fields = FIELD_CATALOG.filter((f) => (data.required_fields || []).includes(f.key));
      return json({
        success: true,
        contactEmail: data.contact_email,
        inviteeName: data.invitee_name,
        status: data.status,
        fields
      });
    }

    // ── submit: store the vendor's answers, mark the invite submitted ─────────
    if (action === 'submit') {
      const { data: invite, error } = await admin.from('vendor_invites')
        .select('*').eq('token', token).maybeSingle();
      if (error) throw new Error(error.message);
      if (!invite) return json({ success: false, message: 'Invite not found.' }, 404);
      if (invite.status === 'approved' || invite.status === 'rejected') {
        return json({ success: false, message: 'This invite can no longer be submitted.' }, 410);
      }

      // Keep only the fields the admin actually requested.
      const submitted = payload?.data || {};
      const cleanData: Record<string, unknown> = {};
      for (const f of (invite.required_fields || [])) {
        if (submitted && submitted[f] !== undefined) cleanData[f] = submitted[f];
      }

      const { error: upErr } = await admin.from('vendor_invites')
        .update({ submitted_data: cleanData, status: 'submitted', updated_at: new Date().toISOString() })
        .eq('token', token);
      if (upErr) throw new Error(upErr.message);

      return json({ success: true, message: 'Onboarding submitted. Awaiting admin approval.' });
    }

    return json({ success: false, message: `Unknown action "${action}".` }, 400);
  } catch (e) {
    return json({ success: false, message: (e as Error).message || 'Onboarding request failed.' }, 500);
  }
});
