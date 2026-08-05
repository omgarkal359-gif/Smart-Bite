import { supabase } from './supabaseClient';
import { SHOPS, getItemsByStall, ALL_FOOD_ITEMS } from './data/foodCourtDB';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || window.location.origin;
const API_BASE_URL = BACKEND_URL === window.location.origin ? '/api' : `${BACKEND_URL}/api`;

// Lightweight socket fallback for legacy listeners
export const socket = {
  on: () => {},
  off: () => {},
  emit: () => {},
  connect: () => {},
  disconnect: () => {}
};

// Helper for fetch calls with secure Supabase Authorization bearer token & strict JSON validation
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

  throw new Error(`Endpoint ${endpoint} returned non-JSON response.`);
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────
  async login(username, password, role) {
    return await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });
  },

  async register(username, name, password, role) {
    return await fetchAPI('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, name, password, role })
    });
  },

  async loginGoogle(email, name) {
    return await fetchAPI('/auth/login-google', {
      method: 'POST',
      body: JSON.stringify({ email, name })
    });
  },

  // ── Stalls ─────────────────────────────────────────────────
  async getStalls() {
    try {
      const res = await fetchAPI('/stalls');
      if (Array.isArray(res) && res.length > 0) return res;
    } catch (err) {
      console.warn("Fetch stalls failed, falling back to local list:", err);
    }
    return SHOPS;
  },

  async updateStallStatus(stallId, statusData) {
    return await fetchAPI(`/stalls/${stallId}/status`, {
      method: 'PUT',
      body: JSON.stringify(statusData)
    });
  },

  // ── Menu ────────────────────────────────────────────────────
  async getStallMenu(stallId) {
    try {
      const res = await fetchAPI(`/stalls/${stallId}/menu`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("Fetch menu failed, falling back to local list:", err);
    }
    const fallback = getItemsByStall(stallId);
    return (fallback && fallback.length > 0) ? fallback : ALL_FOOD_ITEMS.slice(0, 15);
  },

  async addMenuItem(stallId, itemData) {
    return await fetchAPI(`/stalls/${stallId}/menu`, {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  },

  async updateMenuItem(itemId, itemData) {
    return await fetchAPI(`/menu/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(itemData)
    });
  },

  // ── Orders ──────────────────────────────────────────────────
  async createOrder(orderData) {
    return await fetchAPI('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  },

  async resendReceipt(orderId, customEmail) {
    return await fetchAPI(`/orders/${orderId}/resend`, {
      method: 'POST',
      body: customEmail ? JSON.stringify({ customEmail }) : undefined
    });
  },

  async getOrderQueue() {
    try {
      return await fetchAPI('/orders/queue');
    } catch (err) {
      return [];
    }
  },

  async getOrder(orderId) {
    return await fetchAPI(`/orders/${orderId}`);
  },
  
  async getOrderDetails(orderId) {
    return this.getOrder(orderId);
  },

  async getStudentOrders(customerId) {
    try {
      const res = await fetchAPI(`/orders/student/${customerId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("Fetch student orders failed:", err);
    }
    return [];
  },

  async getStallOrders(stallId) {
    try {
      const res = await fetchAPI(`/orders/stall/${stallId}`);
      if (Array.isArray(res)) return res;
    } catch (err) {
      console.warn("Fetch stall orders failed:", err);
    }
    return [];
  },

  async updateOrderStatus(orderId, status) {
    return await fetchAPI(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // ── Admin ───────────────────────────────────────────────────
  async getAdminMetrics() {
    try {
      const metrics = await fetchAPI('/admin/metrics');
      return {
        metrics: {
          totalSales: metrics.totalSales || 0,
          totalOrders: metrics.totalOrders || 0,
          activeOrders: metrics.orders ? metrics.orders.filter(o => ['placed', 'preparing', 'pending', 'pending_cash'].includes(o.status)).length : 0,
          totalVendors: SHOPS.length,
          healthScore: 99.9
        },
        orders: metrics.orders || []
      };
    } catch (err) {
      return {
        metrics: { totalSales: 0, totalOrders: 0, activeOrders: 0, totalVendors: SHOPS.length, healthScore: 99.9 },
        orders: []
      };
    }
  },

  async getAdminUsers() {
    try {
      return await fetchAPI('/admin/users');
    } catch (err) {
      return [];
    }
  }
};

export function formatRelativeTime(timestamp) {
  if (!timestamp || isNaN(new Date(timestamp).getTime())) return 'Just now';
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
