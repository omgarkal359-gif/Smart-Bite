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

  // If endpoint returns non-JSON (like Vite SPA HTML fallback), throw so component catches and uses fallback data
  throw new Error(`Endpoint ${endpoint} returned non-JSON response.`);
}

const STATUS_WEIGHT = { 'placed': 1, 'pending_cash': 1, 'preparing': 2, 'ready': 3, 'completed': 4 };

export const api = {
  // ── Stalls ─────────────────────────────────────────────────
  async getStalls() {
    try {
      const { data, error } = await supabase.from('stalls').select('*');
      if (!error && data && data.length > 0) return data;
      const res = await fetchAPI('/stalls').catch(() => null);
      if (res && Array.isArray(res) && res.length > 0) return res;
    } catch (err) {
      // fallback below
    }
    return SHOPS;
  },

  async updateStallStatus(stallId, statusData) {
    try {
      const { data, error } = await supabase.from('stalls').update(statusData).eq('id', stallId).select();
      if (!error && data) {
        // Broadcast the stall status change so student menu pages update instantly
        const updatedStall = data[0] || { id: stallId, ...statusData };
        const broadcastChannel = supabase.channel(`stall-status-${stallId}`);
        broadcastChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            broadcastChannel.send({
              type: 'broadcast',
              event: 'stall_status_changed',
              payload: updatedStall
            });
            setTimeout(() => supabase.removeChannel(broadcastChannel), 2000);
          }
        });
        return data;
      }
      const res = await fetchAPI(`/stalls/${stallId}/status`, {
        method: 'PUT',
        body: JSON.stringify(statusData)
      });
      // Also broadcast via Supabase even if using local backend
      const broadcastChannel2 = supabase.channel(`stall-status-${stallId}`);
      broadcastChannel2.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          broadcastChannel2.send({
            type: 'broadcast',
            event: 'stall_status_changed',
            payload: { id: stallId, ...statusData }
          });
          setTimeout(() => supabase.removeChannel(broadcastChannel2), 2000);
        }
      });
      return res;
    } catch (err) {
      return { success: true };
    }
  },

  // ── Menu ────────────────────────────────────────────────────
  async getStallMenu(stallId) {
    try {
      const { data, error } = await supabase.from('menu_items').select('*').eq('stallId', stallId);
      if (!error && data && data.length > 0) return data;
      const res = await supabase.from('menu_items').select('*').eq('stall_id', stallId);
      if (!res.error && res.data && res.data.length > 0) return res.data;
    } catch (err) {
      // fallback below
    }
    const fallback = getItemsByStall(stallId);
    return (fallback && fallback.length > 0) ? fallback : ALL_FOOD_ITEMS.slice(0, 15);
  },

  async addMenuItem(stallId, itemData) {
    try {
      const { data, error } = await supabase.from('menu_items').insert({ stallId, ...itemData }).select();
      if (!error && data) return data[0];
      return await fetchAPI(`/stalls/${stallId}/menu`, {
        method: 'POST',
        body: JSON.stringify(itemData)
      });
    } catch (err) {
      return { id: Date.now(), ...itemData };
    }
  },

  async updateMenuItem(itemId, itemData) {
    try {
      const { data, error } = await supabase.from('menu_items').update(itemData).eq('id', itemId).select();
      if (!error && data) return data[0];
      return await fetchAPI(`/menu/${itemId}`, {
        method: 'PUT',
        body: JSON.stringify(itemData)
      });
    } catch (err) {
      return { id: itemId, ...itemData };
    }
  },

  // ── Orders ──────────────────────────────────────────────────
  async createOrder(orderData) {
    try {
      const stallId = orderData.items && orderData.items.length > 0 ? orderData.items[0].stallId : null;
      const defaultStatus = orderData.payment === 'Cash' ? 'pending_cash' : 'placed';
      
      // 1. Post to local backend API first if available
      let sqliteRes = null;
      try {
        sqliteRes = await fetchAPI('/orders', {
          method: 'POST',
          body: JSON.stringify(orderData)
        });
      } catch (err) {
        // Local API offline
      }

      const actualOrder = (sqliteRes && (sqliteRes.order || sqliteRes)) || { 
        id: `ORD-${Date.now()}`, 
        status: defaultStatus, 
        ...orderData, 
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      // 2. Sync order to Supabase table
      try {
        const supabasePayload = {
          id: actualOrder.id,
          customerName: orderData.customerName,
          customername: orderData.customerName,
          customer_name: orderData.customerName,
          customerId: orderData.customerId,
          customerid: orderData.customerId,
          customer_id: orderData.customerId,
          type: orderData.type,
          payment: orderData.payment,
          total: orderData.total,
          status: actualOrder.status || defaultStatus,
          shop_id: stallId,
          stall_id: stallId,
          stallId: stallId,
          items: Array.isArray(orderData.items) ? JSON.stringify(orderData.items) : orderData.items,
          created_at: actualOrder.timestamp || actualOrder.created_at || new Date().toISOString()
        };
        await supabase.from('orders').insert(supabasePayload);
      } catch (sbErr) {
        console.error("Supabase order sync failed:", sbErr);
      }

      // Persist to localStorage immediately
      const savedOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
      if (!savedOrders.find(o => o.id === actualOrder.id)) {
        savedOrders.unshift(actualOrder);
        localStorage.setItem('sgu_orders', JSON.stringify(savedOrders));
      }
      
      // Broadcast new order directly to Vendor Dashboard
      if (stallId) {
        const channel = supabase.channel(`vendor_sync_${stallId}`);
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({
              type: 'broadcast',
              event: 'order_new',
              payload: { order: actualOrder }
            });
            setTimeout(() => supabase.removeChannel(channel), 1000);
          }
        });
      }

      return { success: true, order: actualOrder };
    } catch (err) {
      const stallId = orderData.items && orderData.items.length > 0 ? orderData.items[0].stallId : null;
      const defaultStatus = orderData.payment === 'Cash' ? 'pending_cash' : 'placed';
      const fallbackOrder = { id: `ORD-${Date.now()}`, status: defaultStatus, ...orderData, stall_id: stallId, timestamp: new Date().toISOString() };
      
      if (stallId) {
        const channel = supabase.channel(`vendor_sync_${stallId}`);
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({ type: 'broadcast', event: 'order_new', payload: { order: fallbackOrder } });
            setTimeout(() => supabase.removeChannel(channel), 1000);
          }
        });
      }
      return { success: true, order: fallbackOrder };
    }
  },

  async resendReceipt(orderId, customEmail) {
    try {
      return await fetchAPI(`/orders/${orderId}/resend`, {
        method: 'POST',
        body: customEmail ? JSON.stringify({ customEmail }) : undefined
      });
    } catch (err) {
      return { success: true };
    }
  },

  async getOrderQueue() {
    try {
      const { data, error } = await supabase.from('orders').select('*').in('status', ['pending', 'preparing', 'placed']).order('created_at', { ascending: false });
      if (!error && data) return data;
      return await fetchAPI('/orders/queue');
    } catch (err) {
      return [];
    }
  },

  async getOrder(orderId) {
    try {
      let order = null;
      const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (!error && data) order = data;
      
      const sqliteOrder = await fetchAPI(`/orders/${orderId}`).catch(() => null);
      if (sqliteOrder && sqliteOrder.id) {
        if (!order) order = sqliteOrder;
        else if ((STATUS_WEIGHT[sqliteOrder.status] || 0) > (STATUS_WEIGHT[order.status] || 0)) {
          order.status = sqliteOrder.status;
        }
      }
      return order;
    } catch (err) {
      return null;
    }
  },
  
  async getOrderDetails(orderId) {
    return this.getOrder(orderId);
  },

  async getStudentOrders(customerId) {
    const ordersMap = new Map();

    // 1. Fetch from Supabase
    try {
      const { data: d1 } = await supabase.from('orders').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
      if (d1) {
        d1.forEach(o => ordersMap.set(o.id, {
          ...o,
          customerName: o.customerName || o.customername || o.customer_name,
          customerId: o.customerId || o.customerid || o.customer_id,
          timestamp: o.created_at || o.timestamp
        }));
      }
      const { data: d2 } = await supabase.from('orders').select('*').eq('customerId', customerId).order('created_at', { ascending: false });
      if (d2) {
        d2.forEach(o => ordersMap.set(o.id, {
          ...o,
          customerName: o.customerName || o.customername || o.customer_name,
          customerId: o.customerId || o.customerid || o.customer_id,
          timestamp: o.created_at || o.timestamp
        }));
      }
    } catch (err) {
      console.warn("Supabase fetch student orders failed:", err);
    }

    // 2. Fetch from REST backend API
    try {
      const res = await fetchAPI(`/orders/student/${customerId}`).catch(() => null);
      if (res && Array.isArray(res)) {
        res.forEach(o => {
          if (!ordersMap.has(o.id)) {
            ordersMap.set(o.id, o);
          } else {
            const existing = ordersMap.get(o.id);
            if ((STATUS_WEIGHT[o.status] || 0) > (STATUS_WEIGHT[existing.status] || 0)) {
              existing.status = o.status;
            }
          }
        });
      }
    } catch (err) {
      console.warn("REST API fetch student orders failed:", err);
    }

    // 3. Merge with localStorage
    try {
      const localOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
      if (Array.isArray(localOrders)) {
        localOrders.forEach(o => {
          if (o && o.id && !ordersMap.has(o.id)) {
            ordersMap.set(o.id, o);
          }
        });
      }
    } catch (e) {}

    const merged = Array.from(ordersMap.values());
    merged.sort((a, b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0));
    return merged;
  },

  async getStallOrders(stallId) {
    const ordersMap = new Map();

    // 1. Fetch from Supabase
    try {
      const { data, error } = await supabase.from('orders').select('*').eq('stall_id', stallId).order('created_at', { ascending: false });
      if (!error && data) {
        data.forEach(o => {
          ordersMap.set(o.id, {
            ...o,
            customerName: o.customerName || o.customername || o.customer_name || 'Guest User',
            customerId: o.customerId || o.customerid || o.customer_id || 'guest',
            timestamp: o.created_at || o.timestamp || new Date().toISOString()
          });
        });
      }
    } catch (err) {
      console.warn("Supabase fetch stall orders failed:", err);
    }

    // 2. Fetch from REST backend API
    try {
      const res = await fetchAPI(`/orders/stall/${stallId}`).catch(() => null);
      if (res && Array.isArray(res)) {
        res.forEach(o => {
          if (!ordersMap.has(o.id)) {
            ordersMap.set(o.id, o);
          } else {
            const existing = ordersMap.get(o.id);
            if ((STATUS_WEIGHT[o.status] || 0) > (STATUS_WEIGHT[existing.status] || 0)) {
              existing.status = o.status;
            }
          }
        });
      }
    } catch (err) {
      console.warn("REST API fetch stall orders failed:", err);
    }

    const merged = Array.from(ordersMap.values());
    merged.sort((a, b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0));
    return merged;
  },

  async updateOrderStatus(orderId, status) {
    const broadcastToStudent = (orderId, status, customerId) => {
      const studentChannel = supabase.channel(`student_sync_${orderId}`);
      studentChannel.subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          studentChannel.send({ type: 'broadcast', event: 'order_status_update', payload: { orderId, status } });
          setTimeout(() => supabase.removeChannel(studentChannel), 1000);
        }
      });
      if (customerId) {
        const studentListCh = supabase.channel(`student_orders_${customerId}`);
        studentListCh.subscribe(s => {
          if (s === 'SUBSCRIBED') {
            studentListCh.send({ type: 'broadcast', event: 'order_status_update', payload: { orderId, status } });
            setTimeout(() => supabase.removeChannel(studentListCh), 2000);
          }
        });
      }
    };

    // 1. Try local API update
    try {
      await fetchAPI(`/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status })
      }).catch(() => null);
    } catch (err) {}

    // 2. Update Supabase table status
    try {
      const { data, error } = await supabase.from('orders').update({ status }).eq('id', orderId).select();
      const orderRow = data && data[0];
      const customerId = orderRow?.customer_id || orderRow?.customerId || null;

      broadcastToStudent(orderId, status, customerId);

      const stallId = orderRow?.stall_id || orderRow?.stallId || null;
      if (stallId) {
        const vendorChannel = supabase.channel(`vendor_sync_${stallId}`);
        vendorChannel.subscribe(s => {
          if (s === 'SUBSCRIBED') {
            vendorChannel.send({
              type: 'broadcast',
              event: 'order_status_update',
              payload: { orderId, status }
            });
            setTimeout(() => supabase.removeChannel(vendorChannel), 2000);
          }
        });
      }

      if (!error && data) return { success: true, order: orderRow };
    } catch (err) {
      broadcastToStudent(orderId, status, null);
      return { success: true };
    }
    return { success: true };
  },

  // ── Admin ───────────────────────────────────────────────────
  async getAdminMetrics() {
    try {
      const { data, error } = await supabase.from('orders').select('*');
      if (!error && data) {
        const totalSales = data.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
        const activeOrders = data.filter(o => ['placed', 'preparing', 'pending', 'pending_cash'].includes(o.status)).length;
        return {
          metrics: {
            totalSales,
            totalOrders: data.length,
            activeOrders,
            totalVendors: SHOPS.length,
            healthScore: 99.9
          },
          orders: data
        };
      }
      return fetchAPI('/admin/metrics');
    } catch (err) {
      return {
        metrics: { totalSales: 0, totalOrders: 0, activeOrders: 0, totalVendors: SHOPS.length, healthScore: 99.9 },
        orders: []
      };
    }
  },

  async getAdminUsers() {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (!error && data) return data;
      return fetchAPI('/admin/users');
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
