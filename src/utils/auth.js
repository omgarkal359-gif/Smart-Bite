export const ADMIN_EMAILS = [
  'omgarkal359@gmail.com',
  'omgarkal357@gmail.com',
  'admin@smartbite.in',
  'admin@smartbite',
  'admin@smartbite.com',
  'admin@sgu.edu',
  'admin@sguk.ac.in',
  'admin@sgu.ac.in'
];

export const isAdminEmail = (email) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
};

export const getStoredUser = () => {
  try {
    const token = sessionStorage.getItem('sgu_token') || localStorage.getItem('sgu_token');
    const sessionSaved = sessionStorage.getItem('sgu_user');
    if (token && sessionSaved) {
      const u = JSON.parse(sessionSaved);
      if (u && u.role) return u;
    }
    const localSaved = localStorage.getItem('sgu_user');
    if (token && localSaved) {
      const u = JSON.parse(localSaved);
      if (u && u.role) return u;
    }
  } catch (e) {
    return null;
  }
  return null;
};

export const setStoredUser = (userData, rememberMe = false) => {
  const data = JSON.stringify(userData);
  sessionStorage.setItem('sgu_user', data);
  if (rememberMe) {
    localStorage.setItem('sgu_user', data);
  } else {
    localStorage.removeItem('sgu_user');
  }
};

export const clearStoredUser = () => {
  try {
    sessionStorage.removeItem('sgu_user');
    localStorage.removeItem('sgu_user');
    sessionStorage.removeItem('sgu_token');
    localStorage.removeItem('sgu_token');
    sessionStorage.removeItem('sgu_cart');
    localStorage.removeItem('sgu_cart');
  } catch (e) {
    console.error('Error clearing stored user:', e);
  }
};
