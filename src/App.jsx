import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { MobileLayout } from './components/layout/MobileLayout';
import { CartProvider } from './context/CartContext';
import { supabase } from './supabaseClient';
import { getStoredUser, clearStoredUser } from './utils/auth';

// Helper to automatically reload the page if a chunk fails to load (due to a new deployment)
const lazyWithRetry = (componentImport) => {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('sgu-page-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('sgu-page-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        console.warn('Chunk load failed, forcing a reload to get the latest build...');
        window.sessionStorage.setItem('sgu-page-refreshed', 'true');
        window.location.reload();
        // Return a pending promise so React doesn't crash while the page is reloading
        return new Promise(() => {});
      }
      throw error; // If it already refreshed and still failed, throw the actual error
    }
  });
};

// Dynamic route code splitting
const ShopDirectory = lazyWithRetry(() => import('./pages/ShopDirectory'));
const InteractiveMenu = lazyWithRetry(() => import('./pages/InteractiveMenu'));
const DigitalReceiptTracker = lazyWithRetry(() => import('./pages/DigitalReceiptTracker'));
const VendorDashboard = lazyWithRetry(() => import('./pages/VendorDashboard'));
const PublicOrderBoard = lazyWithRetry(() => import('./pages/PublicOrderBoard'));
const AdminControlCenter = lazyWithRetry(() => import('./pages/AdminControlCenter'));
const UserProfile = lazyWithRetry(() => import('./pages/UserProfile'));
const SearchPage = lazyWithRetry(() => import('./pages/SearchPage'));
const OrdersPage = lazyWithRetry(() => import('./pages/OrdersPage'));
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
const CartPage = lazyWithRetry(() => import('./pages/CartPage'));

// Dynamic Root Redirect based on active session & role
const RootRedirect = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-semibold">Verifying session...</div>;
  }

  // 1. Check stored user session (sessionStorage or localStorage)
  const saved = getStoredUser();
  if (saved) {
    if (saved?.role === 'admin') return <Navigate to="/admin" replace />;
    if (saved?.role === 'owner') return <Navigate to="/vendor" replace />;
    if (saved?.role === 'student' || saved?.role === 'guest') return <Navigate to="/student" replace />;
  }

  // 2. Check Supabase session
  if (session?.user) {
    const role = session.user?.user_metadata?.role || session.user?.app_metadata?.role || 'student';
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'owner') return <Navigate to="/vendor" replace />;
    return <Navigate to="/student" replace />;
  }

  // Force login requirement for unauthenticated users
  return <Navigate to="/login" replace />;
};

// Strict Protected Route Guard Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const [isAllowed, setIsAllowed] = useState(null);

  useEffect(() => {
    async function checkAuth() {
      // 1. Check stored session
      const saved = getStoredUser();
      if (saved) {
        if (saved && saved.role && (!allowedRoles || allowedRoles.includes(saved.role))) {
          setIsAllowed(true);
          return;
        }
      }

      // 2. Check Supabase session
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        const role = data.session.user.user_metadata?.role || data.session.user.app_metadata?.role || 'student';
        if (!allowedRoles || allowedRoles.includes(role)) {
          setIsAllowed(true);
          return;
        }
      }

      setIsAllowed(false);
    }

    checkAuth();
  }, [allowedRoles]);

  if (isAllowed === null) {
    return <div className="flex h-screen items-center justify-center font-semibold">Verifying permissions...</div>;
  }

  if (!isAllowed) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const PageTitleManager = () => {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let title = 'SGU Smart-Bite Enterprise';

    if (path === '/login') title = 'Sign In | SGU Smart-Bite';
    else if (path === '/forgot-password') title = 'Account Security & Recovery | SGU Smart-Bite';
    else if (path === '/reset-password') title = 'Reset Password | SGU Smart-Bite';
    else if (path.startsWith('/student/shop')) title = 'Campus Stall Menu | SGU Smart-Bite';
    else if (path.startsWith('/student/order')) title = 'Digital Receipt & Order Tracker | SGU Smart-Bite';
    else if (path === '/student/orders') title = 'My Placed Orders | SGU Smart-Bite';
    else if (path === '/student/cart') title = 'My Food Cart | SGU Smart-Bite';
    else if (path === '/student/profile') title = 'Student Profile | SGU Smart-Bite';
    else if (path === '/student/search') title = 'Search Campus Food | SGU Smart-Bite';
    else if (path.startsWith('/student')) title = 'Food Court Directory | SGU Smart-Bite';
    else if (path.startsWith('/vendor')) title = 'Vendor Admin Dashboard | SGU Smart-Bite';
    else if (path === '/admin') title = 'System Control Center | SGU Smart-Bite';
    else if (path === '/board') title = 'Live Pickup Board | SGU Smart-Bite';

    document.title = title;
  }, [location]);

  return null;
};

function App() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearStoredUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <CartProvider>
      <BrowserRouter>
        <PageTitleManager />
        <Suspense fallback={<div className="flex h-screen items-center justify-center font-semibold">Loading...</div>}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Strict Protected Student Routes */}
            <Route path="/student" element={
              <ProtectedRoute allowedRoles={['student', 'guest', 'owner', 'admin']}>
                <MobileLayout />
              </ProtectedRoute>
            }>
              <Route index element={<ShopDirectory />} />
              <Route path="shop/:shopId" element={<InteractiveMenu />} />
              <Route path="order/:orderId" element={<DigitalReceiptTracker />} />
              <Route path="profile" element={<UserProfile />} />
              <Route path="search" element={<SearchPage />} /> 
              <Route path="orders" element={<OrdersPage />} />
              <Route path="cart" element={<CartPage />} />
            </Route>
            
            {/* Protected Vendor Dashboard Routes */}
            <Route path="/vendor" element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <VendorDashboard />
              </ProtectedRoute>
            } />
            <Route path="/vendor/:shopId" element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <VendorDashboard />
              </ProtectedRoute>
            } />
            <Route path="/owner/dashboard" element={<Navigate to="/vendor" replace />} />
            
            {/* Protected Order Board Route */}
            <Route path="/board" element={
              <ProtectedRoute allowedRoles={['student', 'guest', 'owner', 'admin']}>
                <PublicOrderBoard />
              </ProtectedRoute>
            } />
            
            {/* Protected Admin Control Center Route */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminControlCenter />
              </ProtectedRoute>
            } />

            {/* Wildcard 404 Fallback Route -> Forces Login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
        <Analytics />
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
