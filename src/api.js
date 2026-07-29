import { supabase } from './supabaseClient';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;
const API_BASE_URL = BACKEND_URL === window.location.origin ? '/api' : `${BACKEND_URL}/api`;

// Lightweight socket fallback
export const socket = {
  on: () => {},
  off: () => {},
  emit: () => {},
  connect: () => {},
  disconnect: () => {}
};

// Helper for fetch calls with secure Supabase Authorization bearer token & safe JSON validation
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  let token = '';
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      token = data.session.access_token;
    }
  } catch (err) {
    // Session optional / unauthenticated endpoints
  }

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    const errorData = isJson ? await response.json().catch(() => ({})) : {};
    throw new Error(errorData.message || `Server error (${response.status}). Please try again later.`);
  }

  if (isJson) {
    return response.json();
  }
  return response.text();
}

/**
 * ============================================================
 * ARCHITECTURE NOTE — BaaS Migration in Progress
 * ============================================================
 * Basic database CRUD operations (getStalls, createOrder,
 * updateOrderStatus, etc.) are being deprecated in favour of
 * direct Supabase SDK calls:
 *
 *   supabase.from('orders').select('*')
 *   supabase.from('orders').insert({ ... })
 *
 * Reasons:
 *  • Lower latency — no Express hop, data comes directly from
 *    the Supabase Postgres edge network.
 *  • Real-time support — SDK subscriptions work out of the box.
 *  • Reduced serverless cold-start surface area.
 *
 * Methods marked "@deprecated" below should be replaced with
 * Supabase SDK calls in their respective components.
 * Only methods that require secret server-side logic (e.g.
 * sending transactional email via Nodemailer, complex admin
 * aggregations) must stay as Vercel Serverless Functions.
 * ============================================================
 */
export const api = {
  // ── Stalls ─────────────────────────────────────────────────

  // @deprecated — Use: supabase.from('stalls').select('*')
  async getStalls() {
    return fetchAPI('/stalls');
  },

  // @deprecated — Use: supabase.from('stalls').update(statusData).eq('id', stallId)
  async updateStallStatus(stallId, statusData) {
    return fetchAPI(`/stalls/${stallId}/status`, {
      method: 'PUT',
      body: JSON.stringify(statusData)
    });
  },

  // ── Menu ────────────────────────────────────────────────────

  // @deprecated — Use: supabase.from('menu_items').select('*').eq('stall_id', stallId)
  async getStallMenu(stallId) {
    return fetchAPI(`/stalls/${stallId}/menu`);
  },

  // @deprecated — Use: supabase.from('menu_items').insert({ stall_id: stallId, ...itemData })
  async addMenuItem(stallId, itemData) {
    return fetchAPI(`/stalls/${stallId}/menu`, {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  },

  // @deprecated — Use: supabase.from('menu_items').update(itemData).eq('id', itemId)
  async updateMenuItem(itemId, itemData) {
    return fetchAPI(`/menu/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(itemData)
    });
  },

  // ── Orders ──────────────────────────────────────────────────

  // @deprecated — Use: supabase.from('orders').insert(orderData)
  async createOrder(orderData) {
    return fetchAPI('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  },

  // ✅ KEEP — Triggers server-side Nodemailer transactional email logic
  async resendReceipt(orderId, customEmail) {
    return fetchAPI(`/orders/${orderId}/resend`, {
      method: 'POST',
      body: customEmail ? JSON.stringify({ customEmail }) : undefined
    });
  },

  // @deprecated — Use: supabase.from('orders').select('*').in('status', ['pending','preparing'])
  async getOrderQueue() {
    return fetchAPI('/orders/queue');
  },

  // @deprecated — Use: supabase.from('orders').select('*').eq('id', orderId).single()
  async getOrder(orderId) {
    return fetchAPI(`/orders/${orderId}`);
  },

  // @deprecated — Use: supabase.from('orders').select('*').eq('id', orderId).single()
  async getOrderDetails(orderId) {
    return fetchAPI(`/orders/${orderId}`);
  },

  // @deprecated — Use: supabase.from('orders').select('*').eq('customer_id', customerId)
  async getStudentOrders(customerId) {
    return fetchAPI(`/orders/student/${customerId}`);
  },

  // @deprecated — Use: supabase.from('orders').select('*').eq('stall_id', stallId)
  async getStallOrders(stallId) {
    return fetchAPI(`/orders/stall/${stallId}`);
  },

  // @deprecated — Use: supabase.from('orders').update({ status }).eq('id', orderId)
  async updateOrderStatus(orderId, status) {
    return fetchAPI(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // ── Admin ───────────────────────────────────────────────────

  // ✅ KEEP — Complex server-side aggregation with secret admin logic
  async getAdminMetrics() {
    return fetchAPI('/admin/metrics');
  }
};

export function formatRelativeTime(timestamp) {
  if (!timestamp || isNaN(new Date(timestamp).getTime())) return 'Unknown time';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  
  if (diffMs < 0) return 'Just now';
  
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) {
    return 'Just now';
  } else if (diffMin < 60) {
    return `${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
  } else if (diffHr < 24) {
    return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  } else if (diffDay === 1) {
    return 'Yesterday';
  } else {
    return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  }
}
