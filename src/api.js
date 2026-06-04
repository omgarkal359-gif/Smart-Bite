import { io } from 'socket.io-client';

// Support dynamic backend URL from local storage (useful for mobile testing with localtunnel)
const savedBackend = typeof window !== 'undefined' ? localStorage.getItem('sgu_backend_url') : null;
const BACKEND_URL = savedBackend || import.meta.env.VITE_BACKEND_URL || window.location.origin;
const API_BASE_URL = BACKEND_URL === window.location.origin ? '/api' : `${BACKEND_URL}/api`;
export const SOCKET_URL = BACKEND_URL;


// Initialize socket client (disabled in production Vercel to prevent connection errors since serverless doesn't support WebSockets)
export const socket = io(SOCKET_URL, {
  autoConnect: !SOCKET_URL.includes('vercel.app')
});

// Helper for fetch calls
async function fetchAPI(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
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
  } catch (err) {
    // Self-healing: if fetch fails and a custom backend URL is configured, clear it and reload the application
    if (typeof window !== 'undefined' && localStorage.getItem('sgu_backend_url')) {
      localStorage.removeItem('sgu_backend_url');
      alert('Custom backend connection failed. Resetting connection URL to default Vercel server and reloading...');
      window.location.reload();
    }
    throw err;
  }
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

  async resendReceipt(orderId, customEmail) {
    return fetchAPI(`/orders/${orderId}/resend`, {
      method: 'POST',
      body: customEmail ? JSON.stringify({ customEmail }) : undefined
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

export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Just now';
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
