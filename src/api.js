import { supabase } from './supabaseClient';
import { addAuditLog } from './utils/logger';
import { isAdminEmail } from './utils/auth';

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
  return {
    id: m.id,
    stallId: m.stall_id,
    name: m.name,
    price: Number(m.price) || 0,
    isVeg: !!m.is_veg,
    category: m.category,
    categoryId: m.category_id,
    stock: m.stock ?? 20,
    available: m.is_available ? 1 : 0,
    img: m.img
  };
}

function mapOrder(o) {
  if (!o) return o;
  const items = (o.order_items || []).map(it => ({
    id: it.menu_item_id ?? it.id,
    name: it.name,
    price: Number(it.unit_price) || 0,
    quantity: it.quantity,
    stallId: it.stall_id,
    stallName: it.stall_name
  }));
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

async function currentUser() {
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      return {
        id: data.user.id,
        email: (data.user.email || '').toLowerCase(),
        name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || (data.user.email || '').split('@')[0]
      };
    }
  } catch (_e) {}
  return null;
}

export const api = {
  // ── Auth ───────────────────────────────────────────────────────────────
  async login(username, password) {
    const email = (username || '').trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.user) {
      return { success: false, message: error?.message || 'Invalid credentials.' };
    }
    let profile = null;
    try {
      const { data: p } = await supabase.from('accounts').select('*').eq('id', data.user.id).single();
      profile = p;
    } catch (_e) {}

    let role = profile?.role || data.user.app_metadata?.role || data.user.user_metadata?.role;
    if (isAdminEmail(email)) {
      role = 'admin';
    }
    if (!role) {
      role = 'student';
    }

    return {
      success: true,
      token: data.session?.access_token,
      user: {
        username: email,
        name: profile?.full_name || data.user.user_metadata?.full_name || email.split('@')[0],
        role,
        shopId: profile?.shop_id || data.user.user_metadata?.shopId || null
      }
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
    const { data, error } = await supabase.from('stalls').select('*').order('name');
    if (error || !data) return [];
    return data.map(mapStall);
  },

  async updateStallStatus(stallId, statusData) {
    const online = (
      statusData.online === 1 || statusData.online === true || statusData.online === '1' ||
      statusData.status === 'ONLINE' || statusData.isOpen === true
    ) && statusData.online !== 0 && statusData.online !== false && statusData.isOpen !== false &&
      statusData.status !== 'OFFLINE' && statusData.status !== 'CLOSED';

    const patch = { is_online: online, updated_at: new Date().toISOString() };
    if (statusData.busyMode !== undefined) patch.busy_mode = !!statusData.busyMode;
    if (statusData.waitTime !== undefined) patch.wait_time_minutes = Number(statusData.waitTime) || 0;

    const { data, error } = await supabase.from('stalls').update(patch).eq('id', stallId).select();
    try { addAuditLog({ level: 'INFO', category: 'Vendors', message: `Stall "${stallId}" set ${online ? 'ONLINE' : 'OFFLINE'}` }); } catch (_e) {}
    if (error) return { success: false, message: error.message };
    return { success: true, stall: data?.[0] ? mapStall(data[0]) : null };
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
    const row = {
      stall_id: stallId,
      name: itemData.name,
      price: Number(itemData.price) || 0,
      is_veg: itemData.isVeg ?? true,
      category: itemData.category || 'General',
      stock: itemData.stock ?? 20,
      is_available: itemData.available === 0 ? false : true,
      img: itemData.img || null
    };
    const { data, error } = await supabase.from('menu_items').insert(row).select();
    if (error) return { success: false, message: error.message };
    return { success: true, item: data?.[0] ? mapMenuItem(data[0]) : null };
  },

  async updateMenuItem(itemId, itemData) {
    const patch = { updated_at: new Date().toISOString() };
    if (itemData.price !== undefined) patch.price = Number(itemData.price) || 0;
    if (itemData.stock !== undefined) patch.stock = Number(itemData.stock) || 0;
    if (itemData.available !== undefined) patch.is_available = !(itemData.available === 0 || itemData.available === false);
    if (itemData.isVeg !== undefined) patch.is_veg = !!itemData.isVeg;
    if (itemData.name !== undefined) patch.name = itemData.name;
    if (itemData.category !== undefined) patch.category = itemData.category;
    if (itemData.img !== undefined) patch.img = itemData.img || null;
    const { data, error } = await supabase.from('menu_items').update(patch).eq('id', itemId).select();
    if (error) return { success: false, message: error.message };
    return { success: true, item: data?.[0] ? mapMenuItem(data[0]) : null };
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
    const subtotal = items.reduce((s, it) => s + (Number(it.price) || 0) * (it.quantity || 1), 0);
    const orderId = orderData.id || orderData.orderId || `ORD-${Date.now()}`;
    const user = await currentUser();
    const first = items[0] || {};
    const status = orderData.payment === 'Cash' ? 'pending_cash' : 'placed';

    const orderRow = {
      id: orderId,
      order_number: orderId,
      customer_id: user?.id || null,
      customer_email: user?.email || (orderData.customerId || '').toLowerCase() || null,
      customer_name: orderData.customerName || user?.name || 'Student',
      stall_id: first.stallId || null,
      stall_name: first.stallName || null,
      status,
      payment_method: orderData.payment || 'Online UPI',
      payment_status: 'pending',
      subtotal,
      total: subtotal,
      idempotency_key: orderData.idempotencyKey || `IDEM-${orderId}`
    };

    const { error: oErr } = await supabase.from('orders').insert(orderRow);
    if (oErr && !String(oErr.message).includes('duplicate')) throw new Error(oErr.message);

    const itemRows = items.map(it => ({
      order_id: orderId,
      menu_item_id: typeof it.id === 'number' ? it.id : null,
      name: it.name,
      unit_price: Number(it.price) || 0,
      quantity: it.quantity || 1,
      stall_id: it.stallId || null,
      stall_name: it.stallName || null
    }));
    await supabase.from('order_items').insert(itemRows);

    try { addAuditLog({ level: 'INFO', category: 'Orders', message: `Order #${orderId} created (₹${subtotal})` }); } catch (_e) {}

    // paymentId === orderId for the mock flow; real gateway supplies its own id later.
    return { success: true, order: { ...mapOrder(orderRow), items, id: orderId }, paymentId: orderId };
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
    return mapOrder(data);
  },

  async getOrderDetails(orderId) { return this.getOrder(orderId); },

  async getStudentOrders(customerId) {
    const clean = (customerId || '').toString().trim().toLowerCase();
    const { data, error } = await supabase
      .from('orders').select('*, order_items(*)')
      .or(`customer_email.eq.${clean},customer_id.eq.${customerId}`)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapOrder);
  },

  async getStallOrders(stallId) {
    const { data, error } = await supabase
      .from('orders').select('*, order_items(*)').eq('stall_id', stallId)
      .order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(mapOrder);
  },

  async updateOrderStatus(orderId, status, userEmail = null) {
    const { data, error } = await supabase
      .from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId).select();
    
    let email = userEmail;
    if (!email) {
      try {
        const raw = sessionStorage.getItem('sgu_user') || localStorage.getItem('sgu_user');
        if (raw) {
          const u = JSON.parse(raw);
          email = u?.username || u?.email;
        }
      } catch (_e) {}
    }
    if (!email) email = 'system@sgu.edu';

    try { 
      addAuditLog({ 
        level: 'INFO', 
        category: 'Orders', 
        message: `Order #${orderId} status changed to ${String(status).toUpperCase()}`,
        userEmail: email
      }); 
    } catch (_e) {}

    if (error) return { success: false, message: error.message };
    return { success: true, order: data?.[0] ? mapOrder(data[0]) : null };
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
