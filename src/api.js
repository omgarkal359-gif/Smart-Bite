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
    const stored = JSON.parse(localStorage.getItem('sgu_stalls') || '[]');

    let stalls = null;
    try {
      const { data, error } = await supabase.from('stalls').select('*');
      if (!error && data && data.length > 0) {
        stalls = data;
      }
    } catch (err) {}

    if (!stalls) {
      try {
        const res = await fetchAPI('/stalls').catch(() => null);
        if (res && Array.isArray(res) && res.length > 0) stalls = res;
      } catch (err) {}
    }

    const baseStalls = (stalls && stalls.length > 0) ? stalls : SHOPS;

    return SHOPS.map(shop => {
      const baseMatch = baseStalls.find(s => String(s.id) === String(shop.id)) || {};
      const localMatch = stored.find(s => String(s.id) === String(shop.id)) || {};
      return {
        ...shop,
        ...baseMatch,
        ...localMatch
      };
    });
  },

  async updateStallStatus(stallId, statusData) {
    try {
      // Local cache update
      try {
        const stored = JSON.parse(localStorage.getItem('sgu_stalls') || '[]');
        const existingIdx = stored.findIndex(s => String(s.id) === String(stallId));
        let updated;
        if (existingIdx >= 0) {
          updated = stored.map(s => String(s.id) === String(stallId) ? { ...s, ...statusData } : s);
        } else {
          updated = [...stored, { id: stallId, ...statusData }];
        }
        localStorage.setItem('sgu_stalls', JSON.stringify(updated));
      } catch (e) {}

      // Socket broadcast
      try {
        socket.emit('stall_status_update', { id: stallId, ...statusData });
      } catch (e) {}

      const { data, error } = await supabase.from('stalls').update(statusData).eq('id', stallId).select();
      if (!error && data) {
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
  // ── Orders ──────────────────────────────────────────────────
  async createOrder(orderData) {
    const stallId = orderData.items && orderData.items.length > 0 ? orderData.items[0].stallId : null;
    const defaultStatus = orderData.payment === 'Cash' ? 'pending_cash' : 'placed';
    const orderId = orderData.id || orderData.orderId || `ORD-${Date.now()}`;
    const now = new Date().toISOString();
    const actualOrder = {
      id: orderId,
      status: defaultStatus,
      ...orderData,
      timestamp: now,
      created_at: now
    };

    // 1. Post to local backend API first (if available)
    try {
      await fetchAPI('/orders', {
        method: 'POST',
        body: JSON.stringify(actualOrder)
      });
    } catch (err) {
      // Local API offline / fallback
    }

    // 2. Sync order and its items to Supabase tables
    try {
      const supabasePayload = {
        id: orderId,
        customername: orderData.customerName,
        customerid: orderData.customerId,
        type: orderData.type,
        payment: orderData.payment,
        status: defaultStatus,
        total: orderData.total,
        time: 'Just now',
        timestamp: now
      };
      await supabase.from('orders').insert(supabasePayload);

      if (Array.isArray(orderData.items)) {
        const itemPayloads = orderData.items.map(item => ({
          orderid: orderId,
          itemid: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          stallid: item.stallId || item.stallid,
          stallname: item.stallName || item.stallname
        }));
        await supabase.from('order_items').insert(itemPayloads);
      }
    } catch (sbErr) {
      console.error("Supabase order sync failed:", sbErr);
    }

    // 3. Persist to localStorage immediately
    try {
      const savedOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
      if (!savedOrders.find(o => String(o.id) === String(orderId))) {
        savedOrders.unshift(actualOrder);
        localStorage.setItem('sgu_orders', JSON.stringify(savedOrders));
      }
    } catch (e) {}

    // 4. Broadcast new order directly to Vendor Dashboard
    if (stallId) {
      try {
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
      } catch (e) {}
    }

    return { success: true, order: actualOrder };
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
      const { data, error } = await supabase.from('orders').select('*').order('timestamp', { ascending: false });
      if (!error && data) {
        const enriched = await Promise.all(data.map(async (order) => {
          const { data: items } = await supabase.from('order_items').select('*').eq('orderid', order.id);
          const firstItem = items && items.length > 0 ? items[0] : {};
          return {
            ...order,
            customerName: order.customername || 'Guest User',
            customerId: order.customerid || 'guest',
            stallId: firstItem.stallid || null,
            stallName: firstItem.stallname || null,
            items: items || []
          };
        }));
        return enriched;
      }
      return await fetchAPI('/orders/queue');
    } catch (err) {
      return [];
    }
  },

  async getOrder(orderId) {
    try {
      let order = null;
      // 1. Query Supabase
      try {
        const { data, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (!error && data) {
          const { data: items } = await supabase.from('order_items').select('*').eq('orderid', orderId);
          const firstItem = items && items.length > 0 ? items[0] : {};
          order = {
            ...data,
            customerId: data.customerid,
            customerName: data.customername,
            stallId: firstItem.stallid,
            stallName: firstItem.stallname,
            items: items || []
          };
        }
      } catch (e) {}
      
      // 2. Query REST API
      const sqliteOrder = await fetchAPI(`/orders/${orderId}`).catch(() => null);
      if (sqliteOrder && sqliteOrder.id) {
        if (!order) order = sqliteOrder;
        else if ((STATUS_WEIGHT[sqliteOrder.status] || 0) > (STATUS_WEIGHT[order.status] || 0)) {
          order.status = sqliteOrder.status;
        }
      }

      // 3. Fallback to localStorage sgu_orders
      if (!order) {
        const savedOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
        const found = savedOrders.find(o => String(o.id) === String(orderId));
        if (found) order = found;
      }

      // 4. Fallback to localStorage vendor orders
      if (!order) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('sgu_vendor_orders_')) {
            try {
              const list = JSON.parse(localStorage.getItem(key) || '[]');
              const found = list.find(o => String(o.id) === String(orderId));
              if (found) {
                order = found;
                break;
              }
            } catch (e) {}
          }
        }
      }

      return order;
    } catch (err) {
      const savedOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
      return savedOrders.find(o => String(o.id) === String(orderId)) || null;
    }
  },
  
  async getOrderDetails(orderId) {
    return this.getOrder(orderId);
  },

  async getStudentOrders(customerId) {
    const ordersMap = new Map();

    // 1. Fetch from Supabase
    try {
      const { data: d1 } = await supabase.from('orders').select('*').eq('customerid', customerId).order('timestamp', { ascending: false });
      if (d1) {
        await Promise.all(d1.map(async (o) => {
          const { data: items } = await supabase.from('order_items').select('*').eq('orderid', o.id);
          ordersMap.set(o.id, {
            ...o,
            customerName: o.customername,
            customerId: o.customerid,
            timestamp: o.timestamp,
            items: items || []
          });
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
      const { data: items, error: itemsErr } = await supabase.from('order_items').select('orderid').eq('stallid', stallId);
      if (!itemsErr && items && items.length > 0) {
        const orderIds = [...new Set(items.map(item => item.orderid))];
        const { data: orders, error: ordersErr } = await supabase.from('orders').select('*').in('id', orderIds).order('timestamp', { ascending: false });
        if (!ordersErr && orders) {
          await Promise.all(orders.map(async (order) => {
            const { data: oItems } = await supabase.from('order_items').select('*').eq('orderid', order.id);
            const stallItems = oItems ? oItems.filter(oi => oi.stallid === stallId) : [];
            ordersMap.set(order.id, {
              ...order,
              customerName: order.customername || 'Guest User',
              customerId: order.customerid || 'guest',
              timestamp: order.timestamp,
              items: stallItems.map(si => `${si.quantity}x ${si.name}`).join(', '),
              originalItems: stallItems
            });
          }));
        }
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
    // 0. Update local storage caches immediately
    try {
      const savedOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
      const updatedSaved = savedOrders.map(o => o.id === orderId ? { ...o, status } : o);
      localStorage.setItem('sgu_orders', JSON.stringify(updatedSaved));

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sgu_vendor_orders_')) {
          try {
            const list = JSON.parse(localStorage.getItem(key) || '[]');
            if (list.some(o => o.id === orderId)) {
              const newList = list.map(o => o.id === orderId ? { ...o, status } : o);
              localStorage.setItem(key, JSON.stringify(newList));
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    try {
      socket.emit('order_status_update', { id: orderId, orderId, status });
    } catch (e) {}

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
      const customerId = orderRow?.customerid || null;

      broadcastToStudent(orderId, status, customerId);

      const { data: orderItems } = await supabase.from('order_items').select('stallid').eq('orderid', orderId);
      const stallId = orderItems && orderItems.length > 0 ? orderItems[0].stallid : null;
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
        const enriched = await Promise.all(data.map(async (order) => {
          const { data: items } = await supabase.from('order_items').select('*').eq('orderid', order.id);
          const firstItem = items && items.length > 0 ? items[0] : {};
          return {
            ...order,
            customerName: order.customername || 'Guest User',
            customerId: order.customerid || 'guest',
            stallId: firstItem.stallid || null,
            stallName: firstItem.stallname || null,
            items: items || []
          };
        }));
        
        const totalSales = enriched.reduce((acc, o) => acc + (Number(o.total) || 0), 0);
        const activeOrders = enriched.filter(o => ['placed', 'preparing', 'pending', 'pending_cash'].includes(o.status)).length;
        return {
          metrics: {
            totalSales,
            totalOrders: enriched.length,
            activeOrders,
            totalVendors: SHOPS.length,
            healthScore: 99.9
          },
          orders: enriched
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
