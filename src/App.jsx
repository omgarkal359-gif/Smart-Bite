import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MobileLayout } from './components/layout/MobileLayout';
import { CartProvider } from './context/CartContext';
import { supabase } from './supabaseClient';

// Dynamic route code splitting
const ShopDirectory = lazy(() => import('./pages/ShopDirectory'));
const InteractiveMenu = lazy(() => import('./pages/InteractiveMenu'));
const DigitalReceiptTracker = lazy(() => import('./pages/DigitalReceiptTracker'));
const VendorDashboard = lazy(() => import('./pages/VendorDashboard'));
const PublicOrderBoard = lazy(() => import('./pages/PublicOrderBoard'));
const AdminControlCenter = lazy(() => import('./pages/AdminControlCenter'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const CartPage = lazy(() => import('./pages/CartPage'));

// Dynamic Root Redirect based on Supabase auth session & role
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
    return <div className="flex h-screen items-center justify-center font-semibold">Loading...</div>;
  }

  if (!session) {
    const saved = localStorage.getItem('sgu_user');
    if (saved) {
      try {
        const u = JSON.parse(saved);
        if (u?.role === 'admin') return <Navigate to="/admin" replace />;
        if (u?.role === 'owner') return <Navigate to="/vendor" replace />;
        if (u?.role === 'student') return <Navigate to="/student" replace />;
      } catch (e) {
        // Fall back to login
      }
    }
    return <Navigate to="/login" replace />;
  }

  const role = session.user?.user_metadata?.role || session.user?.app_metadata?.role || 'student';
  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'owner') return <Navigate to="/vendor" replace />;
  return <Navigate to="/student" replace />;
};

// Protected Route Guard component (Checks both Supabase session & local storage)
const ProtectedRoute = ({ children, allowedRoles }) => {
  const [isAllowed, setIsAllowed] = useState(null);

  useEffect(() => {
    async function checkAuth() {
      // 1. Check local storage session
      const saved = localStorage.getItem('sgu_user');
      if (saved) {
        try {
          const u = JSON.parse(saved);
          if (u && u.role && (!allowedRoles || allowedRoles.includes(u.role))) {
            setIsAllowed(true);
            return;
          }
        } catch (e) {
          // continue to Supabase check
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

function App() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('sgu_user');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <CartProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="flex h-screen items-center justify-center font-semibold">Loading...</div>}>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Student Routes with Mobile Layout wrapper */}
            <Route path="/student" element={<MobileLayout />}>
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
            <Route path="/board" element={<PublicOrderBoard />} />
            
            {/* Protected Admin Control Center Route */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminControlCenter />
              </ProtectedRoute>
            } />

            {/* Wildcard 404 Fallback Route */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
