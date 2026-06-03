import { io } from 'socket.io-client';

// Support dynamic backend URL from local storage (useful for mobile testing with localtunnel)
const savedBackend = typeof window !== 'undefined' ? localStorage.getItem('sgu_backend_url') : null;
const BACKEND_URL = savedBackend || import.meta.env.VITE_BACKEND_URL || window.location.origin;
const API_BASE_URL = BACKEND_URL === window.location.origin ? '/api' : `${BACKEND_URL}/api`;
export const SOCKET_URL = BACKEND_URL;


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
  async login(username, password, role, name) {
    return fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, role, name })
    });
  },

  async googleLogin(email, name) {
    return fetchAPI('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ email, name })
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

  async resendReceipt(orderId) {
    return fetchAPI(`/orders/${orderId}/resend`, {
      method: 'POST'
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
