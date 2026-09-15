export const ADMIN_EMAILS = [
  'omgarkal359@gmail.com',
  'omgarkal357@gmail.com',
  'admin@smartbite.in'
];

export const isAdminEmail = (email) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
};

export const getStoredUser = () => {
  try {
    const sessionActive = sessionStorage.getItem('sgu_logged_in_session') || localStorage.getItem('sgu_logged_in_session');
    
    // Check sessionStorage first
    const sessionSaved = sessionStorage.getItem('sgu_user');
    if (sessionSaved) {
      const u = JSON.parse(sessionSaved);
      if (u && u.role) return u;
    }

    // Fallback to localStorage for persistent session
    const localSaved = localStorage.getItem('sgu_user');
    if (localSaved) {
      const u = JSON.parse(localSaved);
      if (u && u.role) return u;
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
  const data = JSON.stringify(userData);
  sessionStorage.setItem('sgu_logged_in_session', 'true');
  sessionStorage.setItem('sgu_user', data);
  localStorage.setItem('sgu_logged_in_session', 'true');
  localStorage.setItem('sgu_user', data);
};

export const clearStoredUser = () => {
  try {
    sessionStorage.removeItem('sgu_logged_in_session');
    sessionStorage.removeItem('sgu_user');
    localStorage.removeItem('sgu_logged_in_session');
    localStorage.removeItem('sgu_user');
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

