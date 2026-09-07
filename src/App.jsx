import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { MobileLayout } from './components/layout/MobileLayout';
import { CartProvider } from './context/CartContext';
import { supabase } from './supabaseClient';
import { getStoredUser, clearStoredUser, isAdminEmail } from './utils/auth';

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
const OnboardingPage = lazyWithRetry(() => import('./pages/OnboardingPage'));
const ForgotPassword = lazyWithRetry(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
const CartPage = lazyWithRetry(() => import('./pages/CartPage'));
const Unauthorized = lazyWithRetry(() => import('./pages/Unauthorized'));

// Root Redirect: Always redirect main project link to login page
const RootRedirect = () => {
  return <Navigate to="/login" replace />;
};

// Strict Protected Route Guard Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const [authStatus, setAuthStatus] = useState('checking'); // 'checking' | 'allowed' | 'unauthorized' | 'unauthenticated'

  useEffect(() => {
    async function checkAuth() {
      const saved = getStoredUser();

      // 1. Check Supabase active session first
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          const userEmail = (data.session.user.email || '').toLowerCase().trim();
          let role = data.session.user.app_metadata?.role || data.session.user.user_metadata?.role;
          
          if (isAdminEmail(userEmail) || (saved && saved.role === 'admin')) {
            role = 'admin';
          }
          if (!role && saved?.role) {
            role = saved.role;
          }
          if (!role) {
            role = 'student';
          }

          if (!allowedRoles || allowedRoles.includes(role)) {
            setAuthStatus('allowed');
            return;
          } else {
            setAuthStatus('unauthorized');
            return;
          }
        }
      } catch (_e) {}

      // 2. Check active app token & authenticated user
      if (saved && saved.role) {
        if (!allowedRoles || allowedRoles.includes(saved.role)) {
          setAuthStatus('allowed');
          return;
        } else {
          setAuthStatus('unauthorized');
          return;
        }
      }

      // No active login session found -> Force redirect to login page
      setAuthStatus('unauthenticated');
    }

    checkAuth();
  }, [allowedRoles]);

  if (authStatus === 'checking') {
    return <div className="flex h-screen items-center justify-center font-semibold text-slate-700">Verifying security credentials...</div>;
  }

  if (authStatus === 'unauthorized' || authStatus === 'unauthenticated') {
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
            <Route path="/onboard/:token" element={<OnboardingPage />} />
            <Route path="/forgot-password" element={<Navigate to="/login" replace />} />
            <Route path="/reset-password" element={<Navigate to="/login" replace />} />
            
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

            {/* Unauthorized Access Fallback -> Redirect to Login */}
            <Route path="/unauthorized" element={<Navigate to="/login" replace />} />

            {/* Wildcard 404 Fallback Route -> Forces Login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
