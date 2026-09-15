export const ADMIN_EMAILS = [
  'omgarkal359@gmail.com',
  'omgarkal357@gmail.com',
  'admin@smartbite.in'
];

export const isAdminEmail = (email) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
};

// 7 Days Session Duration Configuration (7 days * 24 hours * 60 mins * 60 secs * 1000 ms = 604,800,000 ms)
export const SESSION_EXPIRY_DAYS = 7;
export const SESSION_DURATION_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/**
 * Checks whether a given timestamp is older than 7 days from now.
 * @param {string|number|Date} timestamp
 * @returns {boolean} True if timestamp is expired (> 7 days old)
 */
export const isSessionExpired = (timestamp) => {
  if (!timestamp) return false;
  const loginTime = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (isNaN(loginTime)) return false;
  return (Date.now() - loginTime) > SESSION_DURATION_MS;
};

export const getStoredUser = () => {
  try {
    const sessionActive = sessionStorage.getItem('sgu_logged_in_session') || localStorage.getItem('sgu_logged_in_session');
    const storedTimestamp = sessionStorage.getItem('sgu_login_timestamp') || localStorage.getItem('sgu_login_timestamp');

    let user = null;

    // Check sessionStorage first
    const sessionSaved = sessionStorage.getItem('sgu_user');
    if (sessionSaved) {
      const u = JSON.parse(sessionSaved);
      if (u && u.role) user = u;
    }

    // Fallback to localStorage for persistent session
    if (!user) {
      const localSaved = localStorage.getItem('sgu_user');
      if (localSaved) {
        const u = JSON.parse(localSaved);
        if (u && u.role) user = u;
      }
    }

    if (user) {
      const timestampToCheck = user.loginTimestamp || user.timestamp || storedTimestamp;
      if (timestampToCheck && isSessionExpired(timestampToCheck)) {
        console.warn(`[AUTH SECURITY] Session expired (> ${SESSION_EXPIRY_DAYS} days). Auto-clearing user session.`);
        clearStoredUser();
        return null;
      }
      return user;
    }

    if (sessionActive === 'true') {
      const token = sessionStorage.getItem('sgu_token') || localStorage.getItem('sgu_token');
      if (!token) return null;
    }
  } catch (e) {
    return null;
  }
  return null;
};

export const setStoredUser = (userData, _rememberMe = true) => {
  const now = Date.now();
  const rawTs = userData?.loginTimestamp || (userData?.timestamp ? new Date(userData.timestamp).getTime() : now);
  const validLoginTs = isNaN(rawTs) ? now : rawTs;

  const enrichedUser = {
    ...userData,
    timestamp: userData?.timestamp || new Date(validLoginTs).toISOString(),
    loginTimestamp: validLoginTs,
    expiresAt: validLoginTs + SESSION_DURATION_MS
  };

  const data = JSON.stringify(enrichedUser);
  sessionStorage.setItem('sgu_logged_in_session', 'true');
  sessionStorage.setItem('sgu_user', data);
  sessionStorage.setItem('sgu_login_timestamp', validLoginTs.toString());

  localStorage.setItem('sgu_logged_in_session', 'true');
  localStorage.setItem('sgu_user', data);
  localStorage.setItem('sgu_login_timestamp', validLoginTs.toString());
};

export const clearStoredUser = () => {
  try {
    sessionStorage.removeItem('sgu_logged_in_session');
    sessionStorage.removeItem('sgu_user');
    sessionStorage.removeItem('sgu_login_timestamp');
    localStorage.removeItem('sgu_logged_in_session');
    localStorage.removeItem('sgu_user');
    localStorage.removeItem('sgu_login_timestamp');
    sessionStorage.removeItem('sgu_token');
    localStorage.removeItem('sgu_token');
    sessionStorage.removeItem('sgu_cart');
    localStorage.removeItem('sgu_cart');
  } catch (e) {
    console.error('Error clearing stored user:', e);
  }
};

export const isUserOrder = (order, user) => {
  if (!order) return false;
  if (!user || (!user.id && !user.email && !user.name)) return true;

  const uId = (user.id || '').toString().trim().toLowerCase();
  const uEmail = (user.email || (uId.includes('@') ? uId : '')).toString().trim().toLowerCase();
  const uName = (user.name || '').toString().trim().toLowerCase();

  const oCustId = (order.customerId || order.customer_id || order.customerid || '').toString().trim().toLowerCase();
  const oCustEmail = (order.customerEmail || order.customer_email || (oCustId.includes('@') ? oCustId : '')).toString().trim().toLowerCase();
  const oCustName = (order.customerName || order.customer_name || '').toString().trim().toLowerCase();

  // 1. Direct email match
  if (uEmail && oCustEmail && (uEmail === oCustEmail)) return true;
  // 2. Direct ID match
  if (uId && oCustId && (uId === oCustId)) return true;
  // 3. Cross match (id vs email)
  if (uEmail && oCustId && (uEmail === oCustId)) return true;
  if (uId && oCustEmail && (uId === oCustEmail)) return true;
  // 4. Name match (if specific name)
  if (uName && oCustName && uName === oCustName && uName !== 'student' && uName !== 'guest user' && uName !== 'guest') return true;
  // 5. Default orders placed in the browser session without strict identity
  if (!oCustId || oCustId === '9876543210' || oCustId === 'student' || oCustName === 'student' || oCustName === 'guest user' || oCustName === 'guest') {
    return true;
  }

  return false;
};

export const getLocalOrders = (user = null) => {
  try {
    const saved = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
    if (Array.isArray(saved)) {
      if (user) return saved.filter(o => isUserOrder(o, user));
      return saved;
    }
  } catch (_e) {}
  return [];
};

export const saveLocalOrder = (newOrder) => {
  if (!newOrder || (!newOrder.id && !newOrder.orderId)) return;
  try {
    const existing = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
    const targetId = String(newOrder.id || newOrder.orderId);
    const updated = [newOrder, ...(Array.isArray(existing) ? existing.filter(o => String(o.id || o.orderId) !== targetId) : [])];
    localStorage.setItem('sgu_orders', JSON.stringify(updated));
  } catch (_e) {}
};

