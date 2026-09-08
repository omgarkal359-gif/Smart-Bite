import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import emailService from '../services/EmailService.js';
import logger from '../utils/logger.js';
import { encrypt, last4, payoutCryptoReady } from '../utils/payoutCrypto.js';
import { getPayoutProvider } from '../services/PayoutProviderFactory.js';

const BANK_KEYS = ['account_holder', 'account_number', 'ifsc', 'upi_id'];

// Encrypt + store a vendor's payout details, then register with the payout
// provider (mock now; Cashfree when configured). Never persists raw account no.
async function savePayout(stallId, bank = {}, meta = {}) {
  const patch = { updated_at: new Date().toISOString() };
  if (bank.account_holder !== undefined) patch.account_holder = bank.account_holder || null;
  if (bank.ifsc !== undefined) patch.ifsc = bank.ifsc || null;
  if (bank.upi_id !== undefined) patch.upi_id = bank.upi_id || null;

  if (bank.account_number) {
    if (!payoutCryptoReady()) throw new Error('PAYOUT_ENCRYPTION_KEY is not configured on the server.');
    patch.account_number_enc = encrypt(bank.account_number);
    patch.account_last4 = last4(bank.account_number);
  }

  if (bank.account_number || bank.upi_id) {
    let status = 'pending', vendorId = null;
    try {
      const res = await getPayoutProvider().registerVendor({
        stallId, name: meta.name, email: meta.email, phone: meta.phone,
        accountHolder: bank.account_holder, accountNumber: bank.account_number, ifsc: bank.ifsc, upiId: bank.upi_id
      });
      vendorId = res.vendorId; status = res.status || 'registered';
    } catch (e) {
      status = 'failed';
      logger.warn(`[PAYOUT] register failed for ${stallId}: ${e.message}`);
    }
    patch.payout_status = status;
    if (vendorId) patch.cashfree_vendor_id = vendorId;
  }

  await supabaseAdmin.from('vendors').update(patch).eq('stall_id', stallId);
  return { last4: patch.account_last4 || null, payout_status: patch.payout_status || 'pending', cashfree_vendor_id: patch.cashfree_vendor_id || null };
}

// Service-role client: bypasses RLS so the server can drive the public
// token-based onboarding flow and provision auth accounts on approval.
const supabaseAdmin = (config.SUPABASE_URL && config.SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  : null;

const APP_URL = process.env.APP_URL || process.env.FRONTEND_URL ||
  (config.NODE_ENV === 'production' ? 'https://smart-bite-rosy.vercel.app' : 'http://localhost:5173');

// Canonical field catalogue. `email` is always collected (it is the login id).
export const FIELD_CATALOG = [
  { key: 'full_name',       label: 'Full Name',            group: 'core' },
  { key: 'mobile',          label: 'Mobile Number',        group: 'core' },
  { key: 'business_name',   label: 'Business / Stall Name', group: 'core' },
  { key: 'account_holder',  label: 'Account Holder Name',  group: 'bank' },
  { key: 'account_number',  label: 'Bank Account Number',  group: 'bank' },
  { key: 'ifsc',            label: 'IFSC Code',            group: 'bank' },
  { key: 'upi_id',          label: 'UPI ID',               group: 'bank' },
  { key: 'fssai',           label: 'FSSAI License No.',    group: 'compliance' },
  { key: 'pan',             label: 'PAN',                  group: 'compliance' },
  { key: 'gstin',           label: 'GSTIN',                group: 'compliance' },
  { key: 'address',         label: 'Address',              group: 'compliance' },
  { key: 'category',        label: 'Stall Category',       group: 'stall' },
  { key: 'operating_hours', label: 'Operating Hours',      group: 'stall' },
  { key: 'logo',            label: 'Logo (emoji or URL)',  group: 'stall' }
];
const VALID_KEYS = new Set(FIELD_CATALOG.map(f => f.key));

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `stall-${Date.now()}`;
}
function ensureConfigured(res) {
  if (!supabaseAdmin) {
    res.status(503).json({ success: false, message: 'Onboarding unavailable: SUPABASE_SERVICE_ROLE_KEY not configured.' });
    return false;
  }
  return true;
}

// Shared provisioning: create/refresh the owner auth account + stall + vendor rows.
// Used by both manual onboarding and invite approval.
async function provisionVendor({ email, data = {}, stallIdHint, invitee }) {
  const stallId = stallIdHint ? slugify(stallIdHint) : slugify(data.business_name || invitee || email.split('@')[0]);
  const tempPassword = `Sb-${crypto.randomBytes(5).toString('hex')}`;
  const fullName = data.full_name || invitee || email.split('@')[0];

  // 1. Auth user (vendor bound to the stall)
  let userId = null;
  const { data: listed } = await supabaseAdmin.auth.admin.listUsers();
  const existing = listed?.users?.find(u => u.email?.toLowerCase() === email);
  if (existing) {
    userId = existing.id;
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword,
      app_metadata: { role: 'vendor', shopId: stallId },
      user_metadata: { ...existing.user_metadata, full_name: fullName, role: 'vendor' }
    });
  } else {
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email, password: tempPassword, email_confirm: true,
      app_metadata: { role: 'vendor', shopId: stallId },
      user_metadata: { full_name: fullName, role: 'vendor' }
    });
    if (cErr) {
      console.error('Auth user creation failed:', cErr.message);
      // Don't fail the whole flow — profile/stall are already created
    } else {
      userId = created.user.id;
    }
  }

  // 2. Profile
  if (userId) {
    await supabaseAdmin.from('accounts').upsert({
      id: userId, email, full_name: fullName, role: 'vendor', shop_id: stallId, account_status: 'ACTIVE'
    });
  }

  // 3. Stall row
  await supabaseAdmin.from('stalls').upsert({
    id: stallId,
    name: data.business_name || invitee || stallId,
    category: data.category || 'Campus Stall',
    operating_hours: data.operating_hours || '08:00 AM - 08:00 PM',
    logo: data.logo || null,
    is_online: true, is_active: true, wait_time_minutes: 0,
    updated_at: new Date().toISOString()
  });

  // 4. Vendor business record
  // Keep bank-sensitive keys OUT of the plaintext details blob.
  const safeDetails = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (!BANK_KEYS.includes(k)) safeDetails[k] = v;
  }

  await supabaseAdmin.from('vendors').upsert({
    stall_id: stallId, user_id: userId,
    business_name: data.business_name || invitee || stallId,
    owner_name: fullName, contact_email: email, vendor_status: 'ACTIVE',
    fssai: data.fssai || null,
    details: safeDetails,
    updated_at: new Date().toISOString()
  }, { onConflict: 'stall_id' });

  // Encrypt + register payout details if any bank/UPI info was collected.
  if (data.account_number || data.upi_id || data.account_holder || data.ifsc) {
    try {
      await savePayout(stallId, {
        account_holder: data.account_holder, account_number: data.account_number,
        ifsc: data.ifsc, upi_id: data.upi_id
      }, { name: fullName, email, phone: data.mobile });
    } catch (e) {
      logger.warn(`[PAYOUT] provisioning payout skipped for ${stallId}: ${e.message}`);
    }
  }

  // 5. Welcome email (best-effort)
  const loginLink = `${APP_URL}/login`;
  let previewUrl = null;
  try {
    const sent = await emailService.sendEmail({
      to: email,
      subject: 'Your SGU Smart-Bite vendor account is ready',
      template: 'welcome',
      data: { userName: fullName, loginLink },
      text: `Your vendor account is ready.\n\nLogin: ${loginLink}\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nUse the "Vendor / Admin login" option and change your password after first login.`
    });
    previewUrl = sent?.previewUrl || null;
  } catch (mailErr) {
    logger.warn(`[ONBOARDING] welcome email failed for ${email}: ${mailErr.message}`);
  }

  return { stallId, tempPassword, userId, loginLink, previewUrl };
}

// ── Admin: create an invite + email the onboarding link ──────────────────────
export async function createInvite(req, res, next) {
  if (!ensureConfigured(res)) return;
  try {
    const { email, inviteeName, fields, sendEmail } = req.body || {};
    const clean = (email || '').trim().toLowerCase();
    if (!clean || !/^\S+@\S+\.\S+$/.test(clean)) {
      return res.status(400).json({ success: false, message: 'A valid vendor email is required.' });
    }
    const requiredFields = Array.isArray(fields) ? fields.filter(f => VALID_KEYS.has(f)) : [];

    const token = crypto.randomUUID();
    const { data, error } = await supabaseAdmin.from('vendor_invites').insert({
      token,
      contact_email: clean,
      invitee_name: inviteeName || null,
      required_fields: requiredFields,
      status: 'sent',
      created_by: req.user?.email || 'admin'
    }).select().single();
    if (error) throw new Error(error.message);

    const inviteLink = `${APP_URL}/onboard/${token}`;
    let previewUrl = null;
    let emailed = false;
    if (sendEmail) {
      try {
        const sent = await emailService.sendInvitation(clean, {
          inviteeName: inviteeName || clean.split('@')[0],
          role: 'Stall Vendor',
          stallName: 'SGU Smart-Bite',
          inviteLink
        });
        previewUrl = sent?.previewUrl || null;
        emailed = true;
      } catch (mailErr) {
        logger.warn(`[ONBOARDING] invite email failed for ${clean}: ${mailErr.message}`);
      }
    }

    return res.json({ success: true, invite: data, inviteLink, emailed, previewUrl });
  } catch (err) { next(err); }
}

// ── Admin: list invites ──────────────────────────────────────────────────────
export async function listInvites(req, res, next) {
  if (!ensureConfigured(res)) return;
  try {
    const { data, error } = await supabaseAdmin.from('vendor_invites')
      .select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return res.json({ success: true, invites: data || [], fieldCatalog: FIELD_CATALOG });
  } catch (err) { next(err); }
}

// ── Public: fetch an invite by token (for the onboarding form) ───────────────
export async function getInvite(req, res, next) {
  if (!ensureConfigured(res)) return;
  try {
    const { token } = req.params;
    const { data, error } = await supabaseAdmin.from('vendor_invites')
      .select('contact_email, invitee_name, required_fields, status').eq('token', token).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return res.status(404).json({ success: false, message: 'Invite not found.' });
    if (data.status === 'approved') return res.status(410).json({ success: false, message: 'This onboarding is already complete.' });
    if (data.status === 'rejected') return res.status(410).json({ success: false, message: 'This invite is no longer valid.' });

    const fields = FIELD_CATALOG.filter(f => (data.required_fields || []).includes(f.key));
    return res.json({
      success: true,
      contactEmail: data.contact_email,
      inviteeName: data.invitee_name,
      status: data.status,
      fields
    });
  } catch (err) { next(err); }
}

// ── Public: submit the onboarding form ───────────────────────────────────────
export async function submitOnboarding(req, res, next) {
  if (!ensureConfigured(res)) return;
  try {
    const { token } = req.params;
    const { data: payload } = req.body || {};

    const { data: invite, error } = await supabaseAdmin.from('vendor_invites')
      .select('*').eq('token', token).maybeSingle();
    if (error) throw new Error(error.message);
    if (!invite) return res.status(404).json({ success: false, message: 'Invite not found.' });
    if (invite.status === 'approved' || invite.status === 'rejected') {
      return res.status(410).json({ success: false, message: 'This invite can no longer be submitted.' });
    }

    // Keep only fields the admin actually requested.
    const cleanData = {};
    for (const f of (invite.required_fields || [])) {
      if (payload && payload[f] !== undefined) cleanData[f] = payload[f];
    }

    const { error: upErr } = await supabaseAdmin.from('vendor_invites')
      .update({ submitted_data: cleanData, status: 'submitted', updated_at: new Date().toISOString() })
      .eq('token', token);
    if (upErr) throw new Error(upErr.message);

    return res.json({ success: true, message: 'Onboarding submitted. Awaiting admin approval.' });
  } catch (err) { next(err); }
}

// ── Admin: approve -> provision the vendor account ───────────────────────────
export async function approveInvite(req, res, next) {
  if (!ensureConfigured(res)) return;
  try {
    const { id } = req.params;
    const { data: invite, error } = await supabaseAdmin.from('vendor_invites')
      .select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!invite) return res.status(404).json({ success: false, message: 'Invite not found.' });
    if (invite.status !== 'submitted') {
      return res.status(400).json({ success: false, message: 'Invite must be submitted before approval.' });
    }

    const email = invite.contact_email;
    const prov = await provisionVendor({
      email,
      data: invite.submitted_data || {},
      stallIdHint: req.body?.stallId,
      invitee: invite.invitee_name
    });

    await supabaseAdmin.from('vendor_invites')
      .update({ status: 'approved', stall_id: prov.stallId, updated_at: new Date().toISOString() })
      .eq('id', id);

    return res.json({ success: true, stallId: prov.stallId, email, tempPassword: prov.tempPassword, loginLink: prov.loginLink, previewUrl: prov.previewUrl });
  } catch (err) { next(err); }
}

// ── Admin: manual onboarding — create the vendor account directly from
// admin-entered details (no invite/token, no vendor self-fill). ───────────────
export async function manualCreate(req, res, next) {
  if (!ensureConfigured(res)) return;
  try {
    const { email, data, stallId } = req.body || {};
    const clean = (email || '').trim().toLowerCase();
    if (!clean || !/^\S+@\S+\.\S+$/.test(clean)) {
      return res.status(400).json({ success: false, message: 'A valid vendor email is required.' });
    }
    // Keep only recognised field keys.
    const cleanData = {};
    for (const [k, v] of Object.entries(data || {})) {
      if (VALID_KEYS.has(k) && v !== undefined && v !== '') cleanData[k] = v;
    }
    const prov = await provisionVendor({ email: clean, data: cleanData, stallIdHint: stallId, invitee: cleanData.full_name });
    return res.json({ success: true, email: clean, stallId: prov.stallId, tempPassword: prov.tempPassword, loginLink: prov.loginLink, previewUrl: prov.previewUrl });
  } catch (err) { next(err); }
}

// ── Admin: set/update a vendor's payout (bank) details securely ──────────────
export async function updatePayout(req, res, next) {
  if (!ensureConfigured(res)) return;
  try {
    const { stallId, account_holder, account_number, ifsc, upi_id, name, email, phone } = req.body || {};
    if (!stallId) return res.status(400).json({ success: false, message: 'stallId is required.' });
    const result = await savePayout(stallId,
      { account_holder, account_number, ifsc, upi_id },
      { name, email, phone });
    return res.json({ success: true, ...result });
  } catch (err) { next(err); }
}

// ── Admin: reject an invite ──────────────────────────────────────────────────
export async function rejectInvite(req, res, next) {
  if (!ensureConfigured(res)) return;
  try {
    const { id } = req.params;
    const reason = (req.body?.reason || '').toString().slice(0, 500);
    const { error } = await supabaseAdmin.from('vendor_invites')
      .update({ status: 'rejected', reject_reason: reason, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
    return res.json({ success: true });
  } catch (err) { next(err); }
}
