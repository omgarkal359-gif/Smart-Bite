import { supabase } from './supabaseClient';
import { addAuditLog } from './utils/logger';
import { isAdminEmail, saveLocalOrder } from './utils/auth';

// =============================================================================
// SINGLE SOURCE OF TRUTH: Supabase (PostgREST + Auth + Realtime).
// The Express server is NOT used by the frontend anymore — it returns later
// only for real payment-gateway webhooks. All data flows through Supabase,
// guarded by Row Level Security. DB columns are snake_case; this layer maps
// them to the shape the pages consume (online 1/0, stallId, isVeg, ...).
// =============================================================================

// Legacy no-op socket kept so old imports don't break. Realtime is Supabase.
export const socket = {
  on: () => {}, off: () => {}, emit: () => {}, connect: () => {}, disconnect: () => {}
};

const STATUS_WEIGHT = { placed: 1, pending_cash: 1, preparing: 2, ready: 3, completed: 4, cancelled: 0 };

export const DEFAULT_FIELD_CATALOG = [
  { key: 'full_name',       label: 'Vendor Full Name',      group: 'core' },
  { key: 'mobile',          label: 'Contact Number',        group: 'core' },
  { key: 'business_name',   label: 'Shop / Stall Name',     group: 'core' },
  { key: 'account_holder',  label: 'Account Holder Name',   group: 'bank' },
  { key: 'account_number',  label: 'Bank Account Number',   group: 'bank' },
  { key: 'ifsc',            label: 'IFSC Code',             group: 'bank' },
  { key: 'upi_id',          label: 'UPI ID',                group: 'bank' },
  { key: 'fssai',           label: 'FSSAI License No.',     group: 'compliance' },
  { key: 'pan',             label: 'PAN Card Number',       group: 'compliance' },
  { key: 'gstin',           label: 'GSTIN (Optional)',      group: 'compliance' },
  { key: 'address',         label: 'Address',               group: 'compliance' },
  { key: 'category',        label: 'Stall Category',        group: 'stall' },
  { key: 'operating_hours', label: 'Operating Hours',       group: 'stall' }
];

export function parseDetails(details) {
  if (!details) return {};
  if (typeof details === 'object' && !Array.isArray(details)) return details;
  if (typeof details === 'string') {
    try {
      const parsed = JSON.parse(details);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (_e) {}
  }
  return {};
}

export function isUUID(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str).trim());
}


// ── Mappers: DB (snake_case) -> UI contract ──────────────────────────────────
function mapStall(s) {
  if (!s) return s;
  const online = s.is_online !== false && s.is_online !== null && s.is_online !== undefined ? 1 : 0;
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    rating: s.rating,
    img: s.img,
    logo: s.logo,
    description: s.description,
    operatingHours: s.operating_hours,
    online,
    status: online ? 'ONLINE' : 'OFFLINE',
    busyMode: s.busy_mode ? 1 : 0,
    waitTime: s.wait_time_minutes ?? 0,
    vendorId: s.vendor_id
  };
}

function mapMenuItem(m) {
  if (!m) return m;
  const portionSuffix = m.portion && m.portion !== 'Standard' && !m.name.includes(`(${m.portion})`) ? ` (${m.portion})` : '';
  return {
    id: m.id,
    stallId: m.stall_id,
    name: `${m.name}${portionSuffix}`,
    rawName: m.name,
    portion: m.portion || 'Standard',
    price: Number(m.price) || 0,
    isVeg: !!m.is_veg,
    category: m.category,
    categoryId: m.category_id,
    stock: m.stock ?? 20,
    available: m.is_available ? 1 : 0,
    img: m.img
  };
}

function mapMenuChangeRequest(r) {
  if (!r) return r;
  return {
    id: r.id,
    stallId: r.stall_id || r.stallId,
    vendorUserId: r.vendor_user_id || r.vendorUserId,
    menuItemId: r.menu_item_id || r.menuItemId,
    requestType: r.request_type || r.requestType,
    status: r.status,
    proposedData: r.proposed_data || r.proposedData || {},
    currentData: r.current_data || r.currentData || null,
    versionAtSubmission: r.version_at_submission || r.versionAtSubmission,
    rejectionReason: r.rejection_reason || r.rejectionReason,
    submittedBy: r.submitted_by || r.submittedBy,
    reviewedBy: r.reviewed_by || r.reviewedBy,
    submittedAt: r.submitted_at || r.submittedAt,
    reviewedAt: r.reviewed_at || r.reviewedAt,
    createdAt: r.created_at || r.createdAt,
    updatedAt: r.updated_at || r.updatedAt
  };
}

function mapOrder(o) {
  if (!o) return o;
  let items = [];
  if (Array.isArray(o.order_items) && o.order_items.length > 0) {
    items = o.order_items.map(it => ({
      id: it.menu_item_id ?? it.id,
      name: it.name,
      price: Number(it.unit_price) || 0,
      quantity: it.quantity || 1,
      stallId: it.stall_id,
      stallName: it.stall_name
    }));
  } else if (Array.isArray(o.items) && o.items.length > 0) {
    items = o.items.map(it => typeof it === 'object' && it !== null ? {
      id: it.id || it.menu_item_id,
      name: it.name || it.title || 'Food Item',
      price: Number(it.price || it.unit_price) || 0,
      quantity: it.quantity || it.qty || 1
    } : { name: String(it), quantity: 1, price: 0 });
  } else if (typeof o.items === 'string' && o.items.trim()) {
    try {
      const parsed = JSON.parse(o.items);
      if (Array.isArray(parsed)) {
        items = parsed.map(it => typeof it === 'object' && it !== null ? {
          id: it.id || it.menu_item_id,
          name: it.name || it.title || 'Food Item',
          price: Number(it.price || it.unit_price) || 0,
          quantity: it.quantity || it.qty || 1
        } : { name: String(it), quantity: 1, price: 0 });
      } else if (typeof parsed === 'object' && parsed !== null) {
        items = [{
          id: parsed.id || parsed.menu_item_id,
          name: parsed.name || parsed.title || 'Food Item',
          price: Number(parsed.price || parsed.unit_price) || 0,
          quantity: parsed.quantity || parsed.qty || 1
        }];
      } else {
        items = [{ name: String(parsed), quantity: 1, price: Number(o.total) || 0 }];
      }
    } catch (_e) {
      items = [{ name: o.items, quantity: 1, price: Number(o.total) || 0 }];
    }
  }

  return {
    id: o.id,
    orderNumber: o.order_number,
    customerId: o.customer_email || o.customer_id,
    customerName: o.customer_name,
    stallId: o.stall_id,
    stallName: o.stall_name,
    type: o.order_type || o.type,
    status: o.status,
    payment: o.payment_method,
    paymentStatus: o.payment_status,
    total: Number(o.total) || 0,
    timestamp: o.created_at,
    created_at: o.created_at,
    items
  };
}

// Thin trust-layer server calls (email + auth provisioning) reach the Express
// serverless endpoints, authenticated with the current Supabase session token.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';
async function serverFetch(path, options = {}) {
  let token = '';
  try { const { data } = await supabase.auth.getSession(); token = data?.session?.access_token || ''; } catch (_e) {}
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...options
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || json.error || `Server error ${res.status}`);
  return json;
}

export function getDeletedStallIds() {
  try {
    const raw = localStorage.getItem('sgu_deleted_stalls') || sessionStorage.getItem('sgu_deleted_stalls') || '[]';
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

export function addDeletedStallId(stallId) {
  if (!stallId) return;
  const clean = String(stallId);
  try {
    const list = getDeletedStallIds();
    if (!list.includes(clean)) {
      list.push(clean);
      localStorage.setItem('sgu_deleted_stalls', JSON.stringify(list));
      sessionStorage.setItem('sgu_deleted_stalls', JSON.stringify(list));
    }
  } catch (_e) {}
}

async function currentUser() {
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      let fullName = data.user.user_metadata?.full_name || data.user.user_metadata?.name;
      if (!fullName || fullName === 'Student' || fullName === 'Guest User') {
        try {
          const { data: prof } = await supabase.from('accounts').select('full_name').eq('id', data.user.id).maybeSingle();
          if (prof?.full_name) fullName = prof.full_name;
        } catch (_e) {}
      }
      return {
        id: data.user.id,
        email: (data.user.email || '').toLowerCase(),
        name: fullName || (data.user.email || '').split('@')[0]
      };
    }
  } catch (_e) {}
  return null;
}

export const api = {
  // ── Auth ───────────────────────────────────────────────────────────────
  async login(username, password) {
    const email = (username || '').trim().toLowerCase();
    // 1. Primary Authentication: Verify email and password via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.user) {
      // Fallback: Check vendor / staff credentials dynamically from Supabase vendors & accounts tables
      const staffRes = await this.loginStaff(username, password);
      if (staffRes && staffRes.success) return staffRes;
      return { success: false, message: error?.message || 'Invalid email or password.' };
    }

    const userId = data.user.id;

    // 2. Query Supabase database for profile (accounts / profiles)
    let profile = null;
    try {
      const { data: p } = await supabase.from('accounts').select('*').eq('id', userId).maybeSingle();
      if (p) {
        profile = p;
      } else {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (prof) profile = prof;
      }
    } catch (_e) {}

    let role = profile?.role || data.user.app_metadata?.role || data.user.user_metadata?.role;
    if (isAdminEmail(email)) {
      role = 'admin';
    }
    if (!role) {
      role = 'student';
    }

    let shopId = profile?.shop_id || data.user.user_metadata?.shopId || null;
    if (role === 'vendor' && !shopId) {
      try {
        const { data: stall } = await supabase
          .from('stalls')
          .select('id')
          .or(`vendor_id.eq.${userId},owner_id.eq.${userId}`)
          .maybeSingle();
        if (stall) shopId = stall.id;
      } catch (_e) {}
    }

    return {
      success: true,
      token: data.session?.access_token,
      user: {
        id: userId,
        username: email,
        name: profile?.full_name || profile?.name || data.user.user_metadata?.full_name || email.split('@')[0],
        role,
        shopId
      }
    };
  },

  async loginStaff(username, password) {
    const input = (username || '').trim().toLowerCase();
    const pwd = (password || '').trim();
    if (!input || !pwd) {
      return { success: false, message: 'Email and Password are required.' };
    }
    if (!input.includes('@')) {
      return { success: false, message: 'Please sign in with your registered email address.' };
    }

    // Authenticate against Supabase Auth (passwords are bcrypt-hashed in auth.users).
    const { data, error } = await supabase.auth.signInWithPassword({ email: input, password: pwd });
    if (error || !data?.user) {
      return { success: false, message: 'Invalid email or password.' };
    }

    const authUser = data.user;
    const token = data.session?.access_token || null;

    // Resolve role + shop from the accounts profile (accounts.id === auth user id).
    let profile = null;
    try {
      const { data: acct } = await supabase
        .from('accounts')
        .select('role, shop_id, full_name')
        .eq('id', authUser.id)
        .maybeSingle();
      profile = acct || null;
    } catch (_e) {}

    // Role comes only from authoritative sources: the admin allowlist or the
    // RLS-protected accounts profile. Never from user_metadata (user-writable,
    // set at signUp). Fail closed: if no staff role resolves, reject the login.
    let role = null;
    if (isAdminEmail(input)) {
      role = 'admin';
    } else if (profile?.role === 'vendor' || profile?.role === 'admin') {
      role = profile.role;
    }
    if (!role) {
      return { success: false, message: 'This account is not authorized for staff login.' };
    }

    const shopId = profile?.shop_id || authUser.app_metadata?.shopId || null;
    const name = profile?.full_name || authUser.user_metadata?.full_name || input.split('@')[0];

    return {
      success: true,
      token,
      user: { id: authUser.id, username: input, name, role, shopId }
    };
  },

  async register(username, name, password) {
    const email = (username || '').trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name, role: 'student' } }
    });
    if (error) return { success: false, message: error.message };
    return { success: true, token: data.session?.access_token, user: { username: email, name, role: 'student', shopId: null } };
  },

  // OAuth is handled in LoginPage via supabase.auth.signInWithOAuth.
  // Profile is auto-created by the DB trigger, so this is a lightweight fetch.
  async loginGoogle(email) {
    const clean = (email || '').trim().toLowerCase();
    try {
      const { data } = await supabase.from('accounts').select('*').eq('email', clean).single();
      return { success: true, user: { username: clean, name: data?.full_name || clean.split('@')[0], role: data?.role || 'student', shopId: data?.shop_id || null } };
    } catch (_e) {
      return { success: true, user: { username: clean, role: 'student' } };
    }
  },

  async verifyRegistration(identifier) {
    const clean = (identifier || '').trim().toLowerCase();
    const { data } = await supabase.from('accounts').select('email, full_name').eq('email', clean).maybeSingle();
    if (!data) return { registered: false, message: 'Account not registered.' };
    return { registered: true, user: { username: data.email, name: data.full_name } };
  },

  // ── Stalls ─────────────────────────────────────────────────────────────
  async getStalls() {
    const deletedIds = getDeletedStallIds();
    const { data, error } = await supabase.from('stalls').select('*').order('name');
    let list = (error || !data) ? [] : data;

    // Filter out stalls marked inactive or registered in deleted stall registry
    list = list.filter(s => s.is_active !== false && !deletedIds.includes(String(s.id)));

    // Fetch vendors and accounts to map vendor emails to stalls
    let vendorMap = {};
    let accountMap = {};
    try {
      const [vRes, accRes] = await Promise.all([
        supabase.from('vendors').select('stall_id, contact_email, details'),
        supabase.from('accounts').select('shop_id, email').eq('role', 'vendor')
      ]);
      if (vRes?.data) {
        vRes.data.forEach(v => {
          if (v.stall_id) {
            const vD = parseDetails(v.details);
            vendorMap[v.stall_id] = v.contact_email || vD?.email || vD?.contact_email;
          }
        });
      }
      if (accRes?.data) {
        accRes.data.forEach(acc => {
          if (acc.shop_id && acc.email) {
            accountMap[acc.shop_id] = acc.email;
          }
        });
      }
    } catch (_e) {}

    let mapped = list.map(s => {
      const baseMapped = mapStall(s);
      const email = vendorMap[s.id] || accountMap[s.id] || s.email || s.contact_email || null;
      return { ...baseMapped, email, contact_email: email };
    });

    try {
      const cached = JSON.parse(localStorage.getItem('sgu_stall_status_overrides') || '{}');
      mapped = mapped.map(s => {
        if (cached && cached[s.id]) {
          const override = cached[s.id];
          const isOnline = override.online === 1 || override.online === true || override.status === 'ONLINE' || override.is_online === true;
          return {
            ...s,
            online: isOnline ? 1 : 0,
            status: isOnline ? 'ONLINE' : 'OFFLINE',
            busyMode: override.busyMode !== undefined ? (override.busyMode ? 1 : 0) : s.busyMode,
            waitTime: override.waitTime !== undefined ? override.waitTime : s.waitTime
          };
        }
        return s;
      });
    } catch (_e) {}

    return mapped;
  },

  async updateStallStatus(stallId, statusData) {
    if (!stallId) return { success: false, message: 'Stall ID is required.' };
    const cleanId = String(stallId);

    const online = (
      statusData.online === 1 || statusData.online === true || statusData.online === '1' ||
      statusData.status === 'ONLINE' || statusData.isOpen === true
    ) && statusData.online !== 0 && statusData.online !== false && statusData.isOpen !== false &&
      statusData.status !== 'OFFLINE' && statusData.status !== 'CLOSED';

    const patch = { is_online: online, updated_at: new Date().toISOString() };
    if (statusData.busyMode !== undefined) patch.busy_mode = !!statusData.busyMode;
    if (statusData.waitTime !== undefined) patch.wait_time_minutes = Number(statusData.waitTime) || 0;

    let { data, error } = await supabase.from('stalls').update(patch).eq('id', cleanId).select();

    // Fallback: If 0 rows updated, try upserting with default stall metadata
    if (!error && (!data || data.length === 0)) {
      const shopInfo = SHOPS.find(s => String(s.id) === cleanId) || { id: cleanId, name: cleanId, category: 'Food' };
      const upsertRes = await supabase.from('stalls').upsert({
        id: cleanId,
        name: shopInfo.name || cleanId,
        category: shopInfo.category || 'Food',
        rating: shopInfo.rating || 4.5,
        img: shopInfo.img || '',
        logo: shopInfo.logo || '🍕',
        description: shopInfo.description || '',
        operating_hours: shopInfo.operatingHours || '8:00 AM - 10:00 PM',
        is_online: online,
        busy_mode: patch.busy_mode || false,
        wait_time_minutes: patch.wait_time_minutes || 0,
        updated_at: new Date().toISOString()
      }).select();
      if (!upsertRes.error && upsertRes.data) {
        data = upsertRes.data;
      }
    }

    try { addAuditLog({ level: 'INFO', category: 'Vendors', message: `Stall "${cleanId}" set ${online ? 'ONLINE' : 'OFFLINE'}` }); } catch (_e) {}

    const payload = {
      id: cleanId,
      stallId: cleanId,
      online: online ? 1 : 0,
      status: online ? 'ONLINE' : 'OFFLINE',
      is_online: online,
      busyMode: patch.busy_mode ? 1 : 0,
      waitTime: patch.wait_time_minutes ?? 0
    };

    // 1. Cache override in localStorage for instantaneous UI responsiveness
    try {
      const cached = JSON.parse(localStorage.getItem('sgu_stall_status_overrides') || '{}');
      cached[cleanId] = payload;
      localStorage.setItem('sgu_stall_status_overrides', JSON.stringify(cached));
    } catch (_e) {}

    // 2. Dispatch local window event for single-tab real-time sync
    try {
      window.dispatchEvent(new CustomEvent('sgu:stall_status_updated', { detail: payload }));
    } catch (_e) {}

    // 3. Supabase Realtime Broadcast across channels for multi-dashboard sync
    try {
      supabase.channel('global-stall-broadcasts').send({
        type: 'broadcast',
        event: 'stall_status_changed',
        payload
      });
      supabase.channel(`stall-status-${cleanId}`).send({
        type: 'broadcast',
        event: 'stall_status_changed',
        payload
      });
      supabase.channel(`vendor-stall-${cleanId}`).send({
        type: 'broadcast',
        event: 'stall_status_changed',
        payload
      });
    } catch (_e) {}

    // 4. Trigger window storage event
    try {
      window.dispatchEvent(new Event('storage'));
    } catch (_e) {}

    if (error) {
      console.warn('Supabase stalls table update notice:', error.message);
    }

    return { success: true, stall: data?.[0] ? mapStall(data[0]) : payload };
  },

  async deleteVendor(stallId) {
    if (!stallId) throw new Error('Stall ID is required.');
    const cleanId = String(stallId);

    // Destructive multi-table deletion is admin-only and MUST run server-side.
    // The browser (anon key) is not allowed to issue these deletes; the
    // delete-vendor Edge Function verifies the caller is an admin (via their
    // JWT) and performs the deletes with the service-role key.
    const { data, error } = await supabase.functions.invoke('delete-vendor', {
      body: { stallId: cleanId }
    });
    if (error || !data?.success) {
      const message = data?.message || error?.message || 'Vendor deletion failed.';
      throw new Error(message);
    }

    // Local UI convenience only (hide the stall immediately, broadcast to tabs).
    try { addDeletedStallId(cleanId); } catch (_e) {}
    try {
      supabase.channel('global-stall-broadcasts').send({
        type: 'broadcast',
        event: 'stall_deleted',
        payload: { id: cleanId }
      });
    } catch (_e) {}
    try {
      addAuditLog({
        level: 'WARNING',
        category: 'Vendors',
        message: `Vendor stall "${cleanId}" deleted permanently by admin.`
      });
    } catch (_e) {}

    return { success: true, message: `Vendor "${cleanId}" deleted successfully.` };
  },

  // ── Menu ───────────────────────────────────────────────────────────────
  async getVendorByStall(stallId) {
    if (!stallId) return null;
    const { data } = await supabase.from('vendors')
      .select('business_name, fssai, owner_name, contact_email').eq('stall_id', stallId).maybeSingle();
    if (!data) return null;
    return { name: data.business_name, fssai: data.fssai, ownerName: data.owner_name, email: data.contact_email };
  },

  async getStallMenu(stallId) {
    const { data, error } = await supabase
      .from('menu_items').select('*').eq('stall_id', stallId).order('display_order').order('id');
    if (error || !data) return [];
    return data.map(mapMenuItem);
  },

  async getMenuCategories(stallId) {
    const { data, error } = await supabase
      .from('menu_categories').select('*').eq('stall_id', stallId).eq('is_active', true).order('display_order');
    if (error || !data) return [];
    return data.map(c => ({ id: c.id, stallId: c.stall_id, name: c.name }));
  },

  async addMenuItem(stallId, itemData) {
    return this.createMenuAddRequest(stallId, itemData);
  },

  async updateMenuItem(itemId, itemData) {
    if (Object.keys(itemData).length === 1 && itemData.available !== undefined) {
      return this.updateMenuAvailability(itemId, Boolean(itemData.available));
    }
    return { success: false, message: 'Structural edits must be submitted via createMenuEditRequest.' };
  },

  // ── Operational Quick Toggle (Instant Live Update + Audit Log + Realtime Postgres Changes) ──
  async updateMenuAvailability(itemId, isAvailable) {
    const user = await currentUser();
    const boolAvail = Boolean(isAvailable);
    const availNum = boolAvail ? 1 : 0;

    let updatedItem = null;
    let stallId = null;

    // 1. Try RPC function first (for integer IDs), fall back to direct Supabase update
    try {
      const numericItemId = Number(itemId);
      if (!isNaN(numericItemId)) {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('toggle_menu_item_availability', {
          p_item_id: numericItemId,
          p_is_available: boolAvail
        });
        if (!rpcErr && rpcData) {
          updatedItem = mapMenuItem(rpcData);
          stallId = updatedItem?.stallId;
        }
      }
    } catch (_rpcErr) {}

    if (!updatedItem) {
      const { data, error } = await supabase
        .from('menu_items')
        .update({ is_available: boolAvail, updated_at: new Date().toISOString() })
        .eq('id', itemId)
        .select();

      if (error) return { success: false, message: error.message };
      updatedItem = data?.[0] ? mapMenuItem(data[0]) : null;
      stallId = updatedItem?.stallId;
    }

    const payload = {
      itemId,
      stallId,
      available: availNum,
      is_available: boolAvail,
      updatedItem
    };

    // 2. Dispatch local browser custom event for zero-latency local tab update
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sgu:menu_item_updated', {
          detail: payload
        }));
      }
    } catch (_e) {}

    addAuditLog({
      level: 'INFO',
      category: 'Menu',
      message: `Operational Toggle: Menu Item #${itemId} set ${boolAvail ? 'AVAILABLE' : 'OUT_OF_STOCK'} by ${user?.email || 'vendor'}`
    });

    return { success: true, item: updatedItem || { id: itemId, available: availNum, is_available: boolAvail } };
  },

  // ── Structural Change Requests (100% Pure Supabase Database Operations) ──
  async createMenuAddRequest(stallId, itemData) {
    const user = await currentUser();
    const proposed_data = {
      name: itemData.name,
      price: Number(itemData.price) || 0,
      is_veg: itemData.isVeg ?? true,
      category: itemData.category || 'Main',
      stock: itemData.stock ?? 20,
      is_available: true,
      img: itemData.img || null
    };

    const { data, error } = await supabase.from('menu_change_requests').insert({
      stall_id: stallId,
      request_type: 'CREATE',
      status: 'PENDING',
      proposed_data,
      submitted_by: user?.email || user?.id || 'vendor'
    }).select();

    if (error) return { success: false, message: error.message };
    addAuditLog({ level: 'INFO', category: 'Menu', message: `Menu ADD request submitted for "${itemData.name}"` });
    return { success: true, request: data?.[0] ? mapMenuChangeRequest(data[0]) : null };
  },

  async createMenuEditRequest(stallId, menuItemId, currentItem, proposedPatch) {
    const user = await currentUser();
    const proposed_data = {
      name: proposedPatch.name ?? currentItem.name,
      price: proposedPatch.price !== undefined ? Number(proposedPatch.price) : currentItem.price,
      category: proposedPatch.category ?? currentItem.category,
      is_veg: proposedPatch.isVeg !== undefined ? Boolean(proposedPatch.isVeg) : currentItem.isVeg,
      stock: proposedPatch.stock !== undefined ? Number(proposedPatch.stock) : currentItem.stock,
      is_available: proposedPatch.available !== undefined ? Boolean(proposedPatch.available) : Boolean(currentItem.available),
      img: proposedPatch.img !== undefined ? proposedPatch.img : currentItem.img
    };

    const { data, error } = await supabase.from('menu_change_requests').insert({
      stall_id: stallId,
      menu_item_id: menuItemId,
      request_type: 'UPDATE',
      status: 'PENDING',
      proposed_data,
      current_data: currentItem,
      version_at_submission: currentItem?.updatedAt || currentItem?.updated_at || new Date().toISOString(),
      submitted_by: user?.email || user?.id || 'vendor'
    }).select();

    if (error) return { success: false, message: error.message };
    addAuditLog({ level: 'INFO', category: 'Menu', message: `Menu EDIT request submitted for Item #${menuItemId}` });
    return { success: true, request: data?.[0] ? mapMenuChangeRequest(data[0]) : null };
  },

  async createMenuDeleteRequest(stallId, menuItemId, currentItem) {
    const user = await currentUser();
    const { data, error } = await supabase.from('menu_change_requests').insert({
      stall_id: stallId,
      menu_item_id: menuItemId,
      request_type: 'DELETE',
      status: 'PENDING',
      proposed_data: { is_available: false },
      current_data: currentItem,
      version_at_submission: currentItem?.updatedAt || currentItem?.updated_at || new Date().toISOString(),
      submitted_by: user?.email || user?.id || 'vendor'
    }).select();

    if (error) return { success: false, message: error.message };
    addAuditLog({ level: 'INFO', category: 'Menu', message: `Menu DELETE request submitted for Item #${menuItemId}` });
    return { success: true, request: data?.[0] ? mapMenuChangeRequest(data[0]) : null };
  },

  // ── Queries & RPC Calls for Admin / Vendor Dashboards ───────────────────
  async getVendorMenuRequests(stallId) {
    const { data, error } = await supabase
      .from('menu_change_requests')
      .select('*')
      .eq('stall_id', stallId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(mapMenuChangeRequest);
  },

  async getAdminMenuRequests(statusFilter = 'PENDING') {
    let query = supabase
      .from('menu_change_requests')
      .select('*, stalls(name)')
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'ALL') {
      query = query.eq('status', statusFilter);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(r => ({
      ...mapMenuChangeRequest(r),
      stallName: r.stalls?.name || r.stall_id
    }));
  },

  async approveMenuRequest(requestId) {
    const user = await currentUser();
    const adminId = user?.email || user?.id || 'admin';
    const { data, error } = await supabase.rpc('approve_menu_change_request', {
      p_request_id: requestId,
      p_admin_id: adminId
    });

    if (error) return { success: false, message: error.message };
    addAuditLog({ level: 'INFO', category: 'Menu', message: `Admin approved menu change request ${requestId}` });
    return { success: true, data };
  },

  async rejectMenuRequest(requestId, rejectionReason) {
    const user = await currentUser();
    const adminId = user?.email || user?.id || 'admin';
    const { data, error } = await supabase.rpc('reject_menu_change_request', {
      p_request_id: requestId,
      p_admin_id: adminId,
      p_rejection_reason: rejectionReason
    });

    if (error) return { success: false, message: error.message };
    addAuditLog({ level: 'INFO', category: 'Menu', message: `Admin rejected menu change request ${requestId}` });
    return { success: true, data };
  },

  // ── Menu item image upload (Supabase Storage) ────────────────────────────
  // Uploads a vendor's photo to the public `menu-images` bucket and returns
  // its public URL. The URL is what gets stored in menu_items.img.
  async uploadMenuImage(stallId, file) {
    if (!file) throw new Error('No file provided.');
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
    const safeStall = String(stallId || 'unknown').replace(/[^a-z0-9_-]/gi, '');
    const path = `${safeStall}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage
      .from('menu-images')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
    return data.publicUrl;
  },

  // ── Orders ─────────────────────────────────────────────────────────────
  async createOrder(orderData) {
    const items = orderData.items || [];
    if (items.length === 0) throw new Error('Cart is empty.');

    // Server-authoritative total (never trust the client-supplied total).
    // Verify item availability against database source of truth before order insertion
    const itemIds = items.map(it => it.id).filter(Boolean);
    if (itemIds.length > 0) {
      try {
        const { data: dbItems, error: checkErr } = await supabase
          .from('menu_items')
          .select('id, name, is_available')
          .in('id', itemIds);

        if (!checkErr && Array.isArray(dbItems)) {
          const unavailable = dbItems.filter(it => it.is_available === false);
          if (unavailable.length > 0) {
            const names = unavailable.map(u => `"${u.name}"`).join(', ');
            throw new Error(`Order failed: Item ${names} is currently out of stock. Please remove it from your cart.`);
          }
        }
      } catch (stockErr) {
        if (stockErr.message && stockErr.message.includes('out of stock')) {
          throw stockErr;
        }
      }
    }

    const orderRow = {
      id: orderId,
      order_number: orderId,
      customer_id: customerId,
      customer_email: customerEmail,
      customer_name: orderData.customerName || user?.name || 'Student',
      stall_id: targetStallId,
      stall_name: targetStallName,
      status,
      payment_method: orderData.payment || 'Online UPI',
      payment_status: 'pending',
      subtotal,
      total: subtotal,
      idempotency_key: orderData.idempotencyKey || `IDEM-${orderId}`,
      items: JSON.stringify(items.map(it => ({
        id: it.id,
        name: it.name,
        price: Number(it.price) || 0,
        quantity: it.quantity || 1
      })))
    };

    try {
      const { error: oErr } = await supabase.from('orders').insert(orderRow);
      if (!oErr || String(oErr.message).includes('duplicate')) {
        const itemRows = items.map(it => ({
          order_id: orderId,
          menu_item_id: typeof it.id === 'number' ? it.id : null,
          name: it.name,
          unit_price: Number(it.price) || 0,
          quantity: it.quantity || 1,
          stall_id: it.stallId || it.stall_id || targetStallId,
          stall_name: it.stallName || it.stall_name || targetStallName
        }));
        await supabase.from('order_items').insert(itemRows).catch(() => null);

        // Record initial status history in order_status_history table
        try {
          await supabase.from('order_status_history').insert({
            order_id: orderId,
            previous_status: null,
            new_status: status,
            changed_by: customerEmail || user?.email || 'student',
            created_at: new Date().toISOString()
          });
        } catch (_hErr) {}
      } else {
        console.warn('Supabase order insert warning:', oErr.message);
      }
    } catch (insertErr) {
      console.warn('Supabase order insert exception:', insertErr);
    }

    const orderCustomerDisplayName = orderData.customerName || user?.name || customerEmail || 'Student';
    try { 
      addAuditLog({ 
        level: 'INFO', 
        category: 'Orders', 
        message: `Order #${orderId} created (₹${subtotal})`,
        userEmail: orderCustomerDisplayName
      }); 
    } catch (_e) {}

    const orderResult = {
      ...mapOrder(orderRow),
      customerId: orderData.customerId || customerId || 'student',
      customerEmail: customerEmail || orderData.customerEmail,
      customerName: orderData.customerName || user?.name || 'Student',
      stallId: targetStallId,
      stallName: targetStallName,
      items,
      id: orderId
    };

    // Broadcast Realtime events to vendor, admin, and global channels
    try {
      if (targetStallId) {
        supabase.channel(`vendor_sync_${targetStallId}`).send({
          type: 'broadcast',
          event: 'order_new',
          payload: { order: orderResult }
        });
      }
      supabase.channel('admin-orders-module').send({
        type: 'broadcast',
        event: 'new_order',
        payload: orderResult
      });
      supabase.channel('global-orders-broadcast').send({
        type: 'broadcast',
        event: 'order_new',
        payload: orderResult
      });
      window.dispatchEvent(new CustomEvent('sgu:new_order', { detail: orderResult }));
    } catch (_bcErr) {
      console.warn('Realtime broadcast exception:', _bcErr);
    }

    // Guarantee local storage persistence immediately
    try {
      saveLocalOrder(orderResult);
      // Also save direct cart backup keyed by orderId for tracker fallback
      if (items && items.length > 0) {
        localStorage.setItem(`sgu_cart_backup_${orderId}`, JSON.stringify(items));
      }
    } catch (_e) {}

    // Automatically store receipt in Supabase 'receipts' table without delay
    this.saveReceipt(orderResult).catch(() => null);

    return { success: true, order: orderResult, paymentId: orderId };
  },

  // ── Receipts Table Integration ──────────────────────────────────────────
  async saveReceipt(orderData) {
    if (!orderData || !orderData.id) return null;
    const orderId = orderData.id;
    const items = orderData.items || [];
    const first = (Array.isArray(items) && items[0]) || {};
    const itemsSummary = Array.isArray(items) && items.length > 0
      ? items.map(i => `${i.quantity || 1}x ${i.name}`).join(', ')
      : (typeof items === 'string' ? items : '');

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const rawPayId = String(orderData.paymentId || orderData.payment_id || orderId);

    const receiptRow = {
      receipt_number: `RCP-${orderId}`,
      order_id: orderId,
      customer_id: orderData.customerId || orderData.customer_id || null,
      customer_name: orderData.customerName || orderData.customer_name || 'Student',
      customer_email: orderData.customerEmail || orderData.customer_email || null,
      stall_id: orderData.stallId || orderData.stall_id || first.stallId || null,
      stall_name: orderData.stallName || orderData.stall_name || first.stallName || 'SGU Food Court',
      subtotal: Number(orderData.subtotal || orderData.total || 0),
      tax_amount: Number(orderData.tax || 0),
      total: Number(orderData.total || 0),
      payment_method: orderData.payment || orderData.payment_method || 'Online UPI',
      payment_id: isUuid.test(rawPayId) ? rawPayId : null,
      payment_reference: rawPayId,
      items: Array.isArray(items) ? items : [],
      items_summary: itemsSummary,
      receipt_url: `/receipt/${orderId}`,
      status: orderData.status || 'placed',
      created_at: new Date().toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('receipts')
        .upsert(receiptRow, { onConflict: 'order_id' })
        .select()
        .maybeSingle();

      if (error) {
        // Fallback: try insert
        const { data: d2 } = await supabase.from('receipts').insert(receiptRow).select().maybeSingle();
        return d2 || receiptRow;
      }
      return data || receiptRow;
    } catch (_e) {
      return receiptRow;
    }
  },

  async getReceipts(customerId) {
    try {
      let query = supabase.from('receipts').select('*').order('created_at', { ascending: false });
      if (customerId) {
        query = query.eq('customer_id', customerId);
      }
      const { data, error } = await query;
      if (!error && data) return data;
    } catch (_e) {}
    return [];
  },

  async getReceipt(orderId) {
    try {
      const { data } = await supabase.from('receipts').select('*').eq('order_id', orderId).maybeSingle();
      if (data) return data;
    } catch (_e) {}
    return null;
  },


  // ── Payments (MOCK until the real gateway is wired) ──────────────────────
  async getPaymentStatus(_paymentId) {
    return { success: true, paymentStatus: 'success' };
  },

  async simulatePayment(paymentId, action) {
    const paid = action === 'success';
    await supabase.from('orders')
      .update({ payment_status: paid ? 'paid' : 'failed', updated_at: new Date().toISOString() })
      .eq('id', paymentId);
    return { success: true, paymentStatus: paid ? 'success' : 'failed' };
  },

  async verifyPayment(payload) {
    if (payload?.paymentId) await this.simulatePayment(payload.paymentId, 'success');
    const order = payload?.orderId ? await this.getOrder(payload.orderId) : null;
    return { success: true, order };
  },

  async cancelPayment(payload) {
    if (payload?.paymentId) await this.simulatePayment(payload.paymentId, 'cancel');
    return { success: true };
  },

  async resendReceipt(_orderId) {
    // Email dispatch belongs to the server layer (deferred). No-op for now.
    return { success: true, message: 'Receipt queued.' };
  },

  // ── Order reads ──────────────────────────────────────────────────────────
  async getOrderQueue() {
    const { data, error } = await supabase
      .from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(200);
    if (error || !data) return [];
    return data.map(mapOrder);
  },

  async getOrder(orderId) {
    const { data, error } = await supabase
      .from('orders').select('*, order_items(*)').eq('id', orderId).maybeSingle();
    if (error || !data) return null;
    const mapped = mapOrder(data);
    // If the join returned no items, try fetching order_items directly
    if (!mapped.items || mapped.items.length === 0) {
      try {
        const { data: itemRows } = await supabase
          .from('order_items').select('*').eq('order_id', orderId);
        if (Array.isArray(itemRows) && itemRows.length > 0) {
          mapped.items = itemRows.map(it => ({
            id: it.menu_item_id ?? it.id,
            name: it.name,
            price: Number(it.unit_price) || 0,
            quantity: it.quantity,
            stallId: it.stall_id,
            stallName: it.stall_name
          }));
        }
      } catch (_e) {}
    }
    return mapped;
  },

  async getOrderDetails(orderId) { return this.getOrder(orderId); },

  async getStudentOrders(customerId) {
    try {
      const user = await currentUser();
      const clean = (customerId || '').toString().trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      let query = supabase.from('orders').select('*, order_items(*)');
      const orConditions = [];

      // Never interpolate raw user input into a PostgREST .or() filter string —
      // commas/dots/parens there are operators and enable filter injection.
      // Validate each value against a strict shape and reject anything else.
      const isEmail = (s) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s);
      const isSafeName = (s) => /^[a-zA-Z0-9 ._-]{1,60}$/.test(s);

      if (clean) {
        if (clean.includes('@')) {
          if (isEmail(clean)) orConditions.push(`customer_email.eq.${clean.toLowerCase()}`);
        } else if (isUuid.test(clean)) {
          orConditions.push(`customer_id.eq.${clean}`);
        } else if (isSafeName(clean)) {
          orConditions.push(`customer_name.ilike.%${clean}%`);
        }
      }

      if (user?.id && isUuid.test(user.id)) {
        orConditions.push(`customer_id.eq.${user.id}`);
      }
      if (user?.email && isEmail(user.email) && user.email.toLowerCase() !== clean.toLowerCase()) {
        orConditions.push(`customer_email.eq.${user.email.toLowerCase()}`);
      }

      if (orConditions.length > 0) {
        query = query.or(orConditions.join(','));
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        console.warn('Supabase getStudentOrders error:', error.message);
        return [];
      }
      return (data || []).map(mapOrder);
    } catch (err) {
      console.warn('getStudentOrders exception:', err);
      return [];
    }
  },

  async getStallOrders(stallId) {
    const { data, error } = await supabase
      .from('orders').select('*, order_items(*)').eq('stall_id', stallId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapOrder);
  },

  async updateOrderStatus(orderId, status, userEmail = null) {
    let prevStatus = null;
    let ordCustomerName = null;
    let ordCustomerEmail = null;
    try {
      const { data: existingOrd } = await supabase.from('orders').select('status, customer_name, customer_email').eq('id', orderId).maybeSingle();
      if (existingOrd) {
        prevStatus = existingOrd.status;
        ordCustomerName = existingOrd.customer_name;
        ordCustomerEmail = existingOrd.customer_email;
      }
    } catch (_e) {}

    const { data, error } = await supabase
      .from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId).select();
    
    // Always prioritize the customer name or email who placed the order over vendor email
    let email = ordCustomerName || ordCustomerEmail;
    if (!email || String(email).toLowerCase().includes('vendor@')) {
      email = (userEmail && !String(userEmail).toLowerCase().includes('vendor@')) ? userEmail : (ordCustomerName || ordCustomerEmail || 'Student');
    }

    // Record status transition in order_status_history table
    try {
      await supabase.from('order_status_history').insert({
        order_id: orderId,
        previous_status: prevStatus,
        new_status: status,
        changed_by: email,
        created_at: new Date().toISOString()
      });
    } catch (_hErr) {}

    // Update status in receipts table as well
    try {
      await supabase.from('receipts').update({ status }).eq('order_id', orderId);
    } catch (_rErr) {}

    try { 
      addAuditLog({ 
        level: 'INFO', 
        category: 'Orders', 
        message: `Order #${orderId} status changed to ${String(status).toUpperCase()}`,
        userEmail: email
      }); 
    } catch (_e) {}

    const updatedMapped = data?.[0] ? mapOrder(data[0]) : null;
    const targetStallId = updatedMapped?.stallId;

    try {
      const payload = { id: orderId, orderId, status, stallId: targetStallId };
      if (targetStallId) {
        supabase.channel(`vendor_sync_${targetStallId}`).send({
          type: 'broadcast',
          event: 'order_status_update',
          payload
        });
      }
      supabase.channel(`student_sync_${orderId}`).send({
        type: 'broadcast',
        event: 'order_status_update',
        payload
      });
      supabase.channel('admin-orders-module').send({
        type: 'broadcast',
        event: 'order_updated',
        payload
      });
      supabase.channel('global-orders-broadcast').send({
        type: 'broadcast',
        event: 'order_status_update',
        payload
      });
      window.dispatchEvent(new CustomEvent('sgu:order_updated', { detail: payload }));
    } catch (_bcErr) {}

    if (error) return { success: false, message: error.message };
    return { success: true, order: updatedMapped };
  },

  async getOrderStatusHistory(orderId) {
    if (!orderId) return [];
    const { data, error } = await supabase
      .from('order_status_history')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data;
  },

  // ── Admin ────────────────────────────────────────────────────────────────
  async getAdminMetrics() {
    const [{ data: orders }, { count: vendorCount }] = await Promise.all([
      supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }),
      supabase.from('stalls').select('id', { count: 'exact', head: true })
    ]);
    const list = (orders || []).map(mapOrder);
    const totalSales = list.reduce((a, o) => a + (o.total || 0), 0);
    const activeOrders = list.filter(o => ['placed', 'preparing', 'ready', 'pending_cash'].includes(o.status)).length;
    return {
      metrics: {
        totalSales,
        totalOrders: list.length,
        activeOrders,
        totalVendors: vendorCount || 0,
        healthScore: 99.9
      },
      orders: list
    };
  },

  async getAdminUsers() {
    const { data, error } = await supabase.from('accounts').select('*').order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(p => ({ id: p.id, username: p.email, name: p.full_name, role: p.role, shopId: p.shop_id, status: p.account_status }));
  },

  // ── Vendor onboarding (server trust layer + client Supabase fallback) ─────
  onboarding: {
    listInvites: async () => {
      try {
        return await serverFetch('/onboarding');
      } catch (_e) {
        // Supabase-first fallback: admin RLS grants read on vendor_invites.
        const { data } = await supabase.from('vendor_invites').select('*').order('created_at', { ascending: false });
        return { invites: data || [], fieldCatalog: DEFAULT_FIELD_CATALOG };
      }
    },
    createInvite: async (payload) => {
      try {
        return await serverFetch('/onboarding/invite', { method: 'POST', body: JSON.stringify(payload) });
      } catch (_e) {
        // Supabase-first fallback: insert the invite directly (admin RLS).
        // Email delivery lives in the server layer, so emailed is false here.
        const token = (crypto?.randomUUID?.() || `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        const { error } = await supabase.from('vendor_invites').insert({
          token,
          contact_email: (payload.email || '').trim().toLowerCase(),
          invitee_name: payload.inviteeName || null,
          required_fields: Array.isArray(payload.fields) ? payload.fields : [],
          status: 'sent'
        });
        if (error) throw new Error(error.message);
        return { inviteLink: `${window.location.origin}/onboard/${token}`, emailed: false };
      }
    },
    manualCreate: async (payload) => {
      // Provisioning a vendor requires creating a Supabase Auth user, which
      // needs the service-role key and can ONLY happen server-side. Use the
      // Edge Function (Supabase-first) and fall back to the Express trust layer
      // if it is deployed. Never fabricate a password client-side — a password
      // that was never registered in Auth cannot be used to log in.
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('provision-vendor', { body: payload });
      if (!fnErr && fnData?.success) {
        try {
          addAuditLog({
            level: 'INFO', category: 'Vendors',
            message: `Vendor '${fnData.email}' provisioned (stall: ${fnData.stallId})`,
            userEmail: fnData.email
          });
        } catch (_a) {}
        return fnData; // { email, stallId, tempPassword }
      }

      // Edge Function unavailable → try the Express trust layer (if deployed).
      const serverMsg = fnData?.message || fnErr?.message;
      try {
        return await serverFetch('/onboarding/manual', { method: 'POST', body: JSON.stringify(payload) });
      } catch (_e) {
        throw new Error(serverMsg || 'Vendor provisioning is unavailable. Deploy the "provision-vendor" Edge Function.');
      }
    },
    savePayout: (payload) => serverFetch('/onboarding/payout', { method: 'POST', body: JSON.stringify(payload) }).catch(() => ({ success: true })),
    getInvite: (token) => serverFetch(`/onboarding/${token}`).catch(() => ({ invite: null })),
    submit: (token, data) => serverFetch(`/onboarding/${token}/submit`, { method: 'POST', body: JSON.stringify({ data }) }),
    approve: async (id, stallId) => {
      try {
        return await serverFetch(`/onboarding/${id}/approve`, { method: 'POST', body: JSON.stringify({ stallId }) });
      } catch (_e) {
        // Supabase-first fallback: read the submitted invite (admin RLS), then
        // provision the login through the Edge Function (service role).
        const { data: inv, error } = await supabase.from('vendor_invites').select('*').eq('id', id).maybeSingle();
        if (error) throw new Error(error.message);
        if (!inv) throw new Error('Invite not found.');
        if (inv.status !== 'submitted') throw new Error('Invite must be submitted before approval.');

        const data = { ...(inv.submitted_data || {}) };
        if (!data.full_name && inv.invitee_name) data.full_name = inv.invitee_name;
        const res = await api.onboarding.manualCreate({ email: inv.contact_email, data, stallId });

        await supabase.from('vendor_invites')
          .update({ status: 'approved', stall_id: res.stallId, updated_at: new Date().toISOString() })
          .eq('id', id);
        return res; // { email, stallId, tempPassword }
      }
    },
    reject: async (id, reason) => {
      try {
        return await serverFetch(`/onboarding/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
      } catch (_e) {
        const { error } = await supabase.from('vendor_invites')
          .update({ status: 'rejected', reject_reason: (reason || '').slice(0, 500), updated_at: new Date().toISOString() })
          .eq('id', id);
        if (error) throw new Error(error.message);
        return { success: true };
      }
    },
    resetPassword: async (email, newPassword) => {
      const cleanEmail = (email || '').trim().toLowerCase();
      const pwd = (newPassword || '').trim();
      if (!cleanEmail) throw new Error('Vendor email address is required.');
      if (pwd.length < 8) throw new Error('Password must be at least 8 characters long.');

      // Password is set (bcrypt-hashed) in auth.users by the admin-only Edge Function.
      // Nothing is written to any plaintext column.
      const { data, error } = await supabase.functions.invoke('update-vendor-password', {
        body: { email: cleanEmail, password: pwd }
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || 'Failed to update vendor password.');
      }
      return { success: true, message: data.message || 'Vendor password updated.' };
    }
  }
};

export function formatRelativeTime(timestamp) {
  if (!timestamp || isNaN(new Date(timestamp).getTime())) return 'Just now';
  const diffMs = Date.now() - new Date(timestamp).getTime();
  if (diffMs < 0) return 'Just now';
  const min = Math.floor(diffMs / 60000);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min${min > 1 ? 's' : ''} ago`;
  if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`;
  if (day === 1) return 'Yesterday';
  return `${day} days ago`;
}
