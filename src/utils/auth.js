export const getStoredUser = () => {
  try {
    const sessionSaved = sessionStorage.getItem('sgu_user');
    if (sessionSaved) {
      const u = JSON.parse(sessionSaved);
      if (u && u.role) return u;
    }
    const localSaved = localStorage.getItem('sgu_user');
    if (localSaved) {
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
