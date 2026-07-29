import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MobileLayout } from './components/layout/MobileLayout';
import { CartProvider } from './context/CartContext';

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

// Protected Route Guard component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const savedSession = typeof window !== 'undefined' ? localStorage.getItem('sgu_user') : null;
  if (!savedSession) {
    return <Navigate to="/login" replace />;
  }

  try {
    const user = JSON.parse(savedSession);
    if (!user || !user.role) {
      return <Navigate to="/login" replace />;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return <Navigate to="/login" replace />;
    }
    return children;
  } catch (err) {
    return <Navigate to="/login" replace />;
  }
};

function App() {
  return (
    <CartProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<div className="flex h-screen items-center justify-center font-semibold">Loading...</div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
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
          </Routes>
        </Suspense>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
