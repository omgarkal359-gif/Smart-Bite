import { io } from 'socket.io-client';

const API_BASE_URL = 'http://localhost:3001/api';
export const SOCKET_URL = 'http://localhost:3001';

// Initialize socket client (configured not to connect automatically until needed)
export const socket = io(SOCKET_URL, {
  autoConnect: true
});

// Helper for fetch calls
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
  }

  return response.json();
}

// API Methods
export const api = {
  // Auth
  async login(username, password, role) {
    return fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });
  },

  // Stalls
  async getStalls() {
    return fetchAPI('/stalls');
  },

  async updateStallStatus(stallId, statusData) {
    return fetchAPI(`/stalls/${stallId}/status`, {
      method: 'PUT',
      body: JSON.stringify(statusData)
    });
  },

  // Menu
  async getStallMenu(stallId) {
    return fetchAPI(`/stalls/${stallId}/menu`);
  },

  async addMenuItem(stallId, itemData) {
    return fetchAPI(`/stalls/${stallId}/menu`, {
      method: 'POST',
      body: JSON.stringify(itemData)
    });
  },

  async updateMenuItem(itemId, itemData) {
    return fetchAPI(`/menu/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(itemData)
    });
  },

  // Orders
  async createOrder(orderData) {
    return fetchAPI('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  },

  async getOrderQueue() {
    return fetchAPI('/orders/queue');
  },

  async getOrder(orderId) {
    return fetchAPI(`/orders/${orderId}`);
  },

  async getOrderDetails(orderId) {
    return fetchAPI(`/orders/${orderId}`);
  },

  async getStudentOrders(customerId) {
    return fetchAPI(`/orders/student/${customerId}`);
  },

  async getStallOrders(stallId) {
    return fetchAPI(`/orders/stall/${stallId}`);
  },

  async updateOrderStatus(orderId, status) {
    return fetchAPI(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // Admin
  async getAdminMetrics() {
    return fetchAPI('/admin/metrics');
  }
};
