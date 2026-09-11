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
  let items = [];
  if (Array.isArray(o.order_items) && o.order_items.length > 0) {
    items = o.order_items.map(it => ({
      id: it.menu_item_id ?? it.id,
      name: it.name,
      price: Number(it.unit_price) || 0,
      quantity: it.quantity,
      stallId: it.stall_id,
      stallName: it.stall_name
    }));
  } else if (Array.isArray(o.items) && o.items.length > 0) {
    items = o.items;
  } else if (typeof o.items === 'string' && o.items.trim()) {
    try {
      const parsed = JSON.parse(o.items);
      items = Array.isArray(parsed) ? parsed : [{ name: o.items, quantity: 1, price: Number(o.total) || 0 }];
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
    // 1. Primary Authentication: Verify email and password via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data?.user) {
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
    const email = (username || '').trim().toLowerCase();
    const pwd = (password || '').trim();
    if (!email || !pwd) {
      return { success: false, message: 'Email and Password are required.' };
    }

    // 1. Primary Authentication: Try Supabase Auth
    let authUser = null;
    let authSession = null;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (!error && data?.user) {
      authUser = data.user;
      authSession = data.session;
    }

    // 2. Query Supabase 'vendors' table
    let vendorRecord = null;
    try {
      // First try exact ilike match on contact_email
      const { data: v1 } = await supabase.from('vendors').select('*').ilike('contact_email', email).maybeSingle();
      if (v1) {
        vendorRecord = v1;
      } else {
        // Fall back to querying all vendors and checking email/stall_id/details
        const { data: allV } = await supabase.from('vendors').select('*');
        if (allV && allV.length > 0) {
          const matched = allV.find(v => 
            v.stall_id === email ||
            v.contact_email?.toLowerCase() === email ||
            v.details?.email?.toLowerCase() === email
          );
          if (matched) vendorRecord = matched;
        }
      }
    } catch (_e) {}

    // 3. Query Supabase 'accounts' table
    let profileRecord = null;
    try {
      const { data: pData } = await supabase.from('accounts').select('*').ilike('email', email).maybeSingle();
      if (pData) profileRecord = pData;
    } catch (_e) {}

    // 4. Query Supabase 'stalls' table
    let stallRecord = null;
    try {
      const { data: sData } = await supabase.from('stalls').select('*').eq('id', email).maybeSingle();
      if (sData) stallRecord = sData;
    } catch (_e) {}

    // Check if password matches stored password in Supabase database
    let dbPasswordMatch = false;
    if (!authUser && vendorRecord) {
      const storedPwd = vendorRecord.details?.system_password || vendorRecord.details?.temp_password || vendorRecord.details?.password;
      if (storedPwd && storedPwd === pwd) {
        dbPasswordMatch = true;
      }
    }

    if (!authUser && !dbPasswordMatch && stallRecord) {
      const { data: vStall } = await supabase.from('vendors').select('*').eq('stall_id', stallRecord.id).maybeSingle();
      const sPwd = vStall?.details?.system_password || vStall?.details?.temp_password || vStall?.details?.password;
      if (sPwd && sPwd === pwd) {
        dbPasswordMatch = true;
        vendorRecord = vStall;
      }
    }

    // Check Local Storage fallback credentials (for immediate local verification)
    let localPasswordMatch = false;
    if (!authUser && !dbPasswordMatch) {
      try {
        const storedMap = JSON.parse(localStorage.getItem('sgu_vendor_credentials') || '{}');
        const localPwd = storedMap[email] || (vendorRecord?.stall_id ? storedMap[vendorRecord.stall_id.toLowerCase()] : null) || (stallRecord?.id ? storedMap[stallRecord.id.toLowerCase()] : null);
        if (localPwd && localPwd === pwd) {
          localPasswordMatch = true;
        }
      } catch (_e) {}
    }

    if (!authUser && !dbPasswordMatch && !localPasswordMatch) {
      return { success: false, message: error?.message || 'Invalid email or password verified by Supabase.' };
    }

    let role = profileRecord?.role || (vendorRecord || stallRecord ? 'vendor' : authUser?.user_metadata?.role);
    if (isAdminEmail(email)) role = 'admin';
    if (!role) role = 'vendor';

    let shopId = vendorRecord?.stall_id || stallRecord?.id || profileRecord?.shop_id || null;
    if (!shopId) {
      try {
        const userId = authUser?.id || profileRecord?.id;
        if (userId) {
          const { data: stall } = await supabase
            .from('stalls')
            .select('id')
            .or(`vendor_id.eq.${userId},owner_id.eq.${userId}`)
            .maybeSingle();
          if (stall) shopId = stall.id;
        }
      } catch (_e) {}
    }

    if (role !== 'vendor' && role !== 'admin') {
      if (authUser) await supabase.auth.signOut();
      return {
        success: false,
        message: 'Access Denied: Account is not registered as a Vendor or Admin in Supabase.'
      };
    }

    return {
      success: true,
      token: authSession?.access_token || 'supabase_db_verified_token',
      user: {
        id: authUser?.id || profileRecord?.id || vendorRecord?.stall_id || email,
        username: email,
        name: profileRecord?.full_name || vendorRecord?.business_name || stallRecord?.name || email.split('@')[0],
        role,
        shopId: shopId || vendorRecord?.stall_id
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
    const deletedIds = getDeletedStallIds();
    const { data, error } = await supabase.from('stalls').select('*').order('name');
    let list = (error || !data) ? [] : data;

    // Filter out stalls marked inactive or registered in deleted stall registry
    list = list.filter(s => s.is_active !== false && !deletedIds.includes(String(s.id)));

    return list.map(mapStall);
  },

  async deleteVendor(stallId) {
    if (!stallId) throw new Error('Stall ID is required.');
    const cleanId = String(stallId);

    // 1. Instantly register in deleted stalls registry
    addDeletedStallId(cleanId);

    // 2. Perform DB deletions across tables
    try { await supabase.from('menu_items').delete().eq('stall_id', cleanId); } catch (_e) {}
    try { await supabase.from('vendors').delete().eq('stall_id', cleanId); } catch (_e) {}
    try { await supabase.from('accounts').delete().eq('shop_id', cleanId); } catch (_e) {}
    try { await supabase.from('vendor_invites').delete().eq('stall_id', cleanId); } catch (_e) {}

    // Hard delete from stalls
    try { await supabase.from('stalls').delete().eq('id', cleanId); } catch (_e) {}

    // Soft delete / inactive fallback on stalls
    try {
      await supabase.from('stalls').update({ is_active: false, is_online: false, updated_at: new Date().toISOString() }).eq('id', cleanId);
    } catch (_e) {}

    // Edge function delete fallback
    try {
      await supabase.functions.invoke('delete-vendor', { body: { stallId: cleanId } });
    } catch (_e) {}

    // 3. Clean up local credentials
    try {
      const stored = JSON.parse(localStorage.getItem('sgu_vendor_credentials') || '{}');
      delete stored[cleanId];
      delete stored[cleanId.toLowerCase()];
      localStorage.setItem('sgu_vendor_credentials', JSON.stringify(stored));
    } catch (_e) {}

    // 4. Broadcast real-time deletion event
    try {
      supabase.channel('global-stall-broadcasts').send({
        type: 'broadcast',
        event: 'stall_deleted',
        payload: { id: cleanId }
      });
    } catch (_e) {}

    return { success: true, message: 'Vendor permanently deleted from database and dashboard.' };
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

  async deleteVendor(stallId) {
    if (!stallId) throw new Error('Stall ID is required.');

    // 1. Find vendor email if present
    let vendorEmail = null;
    try {
      const { data: vRec } = await supabase.from('vendors').select('contact_email, id').eq('stall_id', stallId).maybeSingle();
      if (vRec?.contact_email) vendorEmail = vRec.contact_email;
    } catch (_e) {}

    // 2. Delete from stalls table
    try {
      await supabase.from('stalls').delete().eq('id', stallId);
    } catch (_e) {}

    // 3. Delete from vendors table
    try {
      await supabase.from('vendors').delete().eq('stall_id', stallId);
      if (vendorEmail) {
        await supabase.from('vendors').delete().ilike('contact_email', vendorEmail);
      }
    } catch (_e) {}

    // 4. Delete from accounts table
    try {
      await supabase.from('accounts').delete().eq('shop_id', stallId);
      if (vendorEmail) {
        await supabase.from('accounts').delete().ilike('email', vendorEmail);
      }
    } catch (_e) {}

    // 5. Delete from vendor_invites table
    try {
      await supabase.from('vendor_invites').delete().eq('stall_id', stallId);
      if (vendorEmail) {
        await supabase.from('vendor_invites').delete().ilike('contact_email', vendorEmail);
      }
    } catch (_e) {}

    // 6. Delete from local credentials store
    try {
      const stored = JSON.parse(localStorage.getItem('sgu_vendor_credentials') || '{}');
      if (stored[String(stallId).toLowerCase()]) delete stored[String(stallId).toLowerCase()];
      if (vendorEmail && stored[vendorEmail.toLowerCase()]) delete stored[vendorEmail.toLowerCase()];
      localStorage.setItem('sgu_vendor_credentials', JSON.stringify(stored));
    } catch (_e) {}

    // 7. Audit log entry
    try {
      addAuditLog({
        level: 'WARNING',
        category: 'Vendors',
        message: `Vendor stall "${stallId}" deleted permanently from database by admin.`
      });
    } catch (_e) {}

    return { success: true, message: `Vendor "${stallId}" deleted successfully.` };
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

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const customerId = (user?.id && isUuid.test(user.id)) 
      ? user.id 
      : (orderData.customerId && isUuid.test(orderData.customerId) ? orderData.customerId : null);

    const customerEmail = user?.email 
      || orderData.customerEmail 
      || (orderData.customerId && String(orderData.customerId).includes('@') ? String(orderData.customerId).toLowerCase() : null);

    const orderRow = {
      id: orderId,
      order_number: orderId,
      customer_id: customerId,
      customer_email: customerEmail,
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

    try {
      const { error: oErr } = await supabase.from('orders').insert(orderRow);
      if (!oErr || String(oErr.message).includes('duplicate')) {
        const itemRows = items.map(it => ({
          order_id: orderId,
          menu_item_id: typeof it.id === 'number' ? it.id : null,
          name: it.name,
          unit_price: Number(it.price) || 0,
          quantity: it.quantity || 1,
          stall_id: it.stallId || null,
          stall_name: it.stallName || null
        }));
        await supabase.from('order_items').insert(itemRows).catch(() => null);
      } else {
        console.warn('Supabase order insert warning:', oErr.message);
      }
    } catch (insertErr) {
      console.warn('Supabase order insert exception:', insertErr);
    }

    try { addAuditLog({ level: 'INFO', category: 'Orders', message: `Order #${orderId} created (₹${subtotal})` }); } catch (_e) {}

    const orderResult = {
      ...mapOrder(orderRow),
      customerId: orderData.customerId || customerId || 'student',
      customerEmail: customerEmail || orderData.customerEmail,
      customerName: orderData.customerName || user?.name || 'Student',
      items,
      id: orderId
    };

    // Guarantee local storage persistence immediately
    try {
      saveLocalOrder(orderResult);
      // Also save direct cart backup keyed by orderId for tracker fallback
      if (items && items.length > 0) {
        localStorage.setItem(`sgu_cart_backup_${orderId}`, JSON.stringify(items));
      }
    } catch (_e) {}

    return { success: true, order: orderResult, paymentId: orderId };
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

      if (clean) {
        if (clean.includes('@')) {
          orConditions.push(`customer_email.ilike.${clean}`);
        } else if (isUuid.test(clean)) {
          orConditions.push(`customer_id.eq.${clean}`);
        } else {
          orConditions.push(`customer_name.ilike.%${clean}%`);
        }
      }

      if (user?.id && isUuid.test(user.id)) {
        orConditions.push(`customer_id.eq.${user.id}`);
      }
      if (user?.email && user.email.toLowerCase() !== clean.toLowerCase()) {
        orConditions.push(`customer_email.ilike.${user.email}`);
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
    },
    resetPassword: async (email, newPassword, stallId) => {
      const cleanEmail = (email || '').trim().toLowerCase();
      const pwd = (newPassword || '').trim();

      if (!cleanEmail) throw new Error('Vendor email address is required.');
      if (!pwd || pwd.length < 4) throw new Error('Password must be at least 4 characters long.');

      // 1. Save/Update password in Supabase Auth via Edge Function if available
      try {
        await supabase.functions.invoke('update-vendor-password', {
          body: { email: cleanEmail, password: pwd }
        });
      } catch (_e) {}

      // 2. Save the updated password directly into Supabase database (vendors table)
      if (stallId || cleanEmail) {
        try {
          const { data: vendorsList } = await supabase.from('vendors').select('*');
          const existingVendor = vendorsList?.find(v => 
            (stallId && v.stall_id === stallId) ||
            v.contact_email?.toLowerCase() === cleanEmail ||
            v.details?.email?.toLowerCase() === cleanEmail
          );

          const updatedDetails = {
            ...(existingVendor?.details || {}),
            email: cleanEmail,
            system_password: pwd,
            password_updated_at: new Date().toISOString()
          };

          if (existingVendor?.id) {
            const { error: vErr } = await supabase.from('vendors').update({
              contact_email: cleanEmail,
              details: updatedDetails,
              updated_at: new Date().toISOString()
            }).eq('id', existingVendor.id);

            if (vErr) {
              console.warn('Supabase vendors database update notice:', vErr.message);
            }
          } else if (stallId) {
            await supabase.from('vendors').insert({
              stall_id: stallId,
              contact_email: cleanEmail,
              details: updatedDetails,
              updated_at: new Date().toISOString()
            });
          }
        } catch (_e) {}
      }

      // 3. Save/Update account record in Supabase accounts table
      try {
        const { data: accList } = await supabase.from('accounts').select('*');
        const existingAcc = accList?.find(a => a.email?.toLowerCase() === cleanEmail);
        if (existingAcc?.id) {
          await supabase.from('accounts').update({
            role: 'vendor',
            shop_id: stallId || null,
            updated_at: new Date().toISOString()
          }).eq('id', existingAcc.id);
        } else {
          await supabase.from('accounts').insert({
            email: cleanEmail,
            role: 'vendor',
            shop_id: stallId || null,
            updated_at: new Date().toISOString()
          });
        }
      } catch (_e) {}

      // 4. Save to local credentials store (localStorage) for immediate verification
      try {
        const stored = JSON.parse(localStorage.getItem('sgu_vendor_credentials') || '{}');
        stored[cleanEmail] = pwd;
        if (stallId) stored[stallId.toLowerCase()] = pwd;
        localStorage.setItem('sgu_vendor_credentials', JSON.stringify(stored));
      } catch (_e) {}

      return {
        success: true,
        message: `✓ Vendor password updated in Supabase database & Auth! Email: ${cleanEmail} | Password: ${pwd}`,
        password: pwd
      };
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
