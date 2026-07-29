import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MobileLayout } from './components/layout/MobileLayout';
import { CartProvider } from './context/CartContext';

// Lazy load route components for code splitting & maximum performance
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

const BrandedLoadingSpinner = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0F172A',
    color: '#FFFFFF',
    fontFamily: "'Inter', sans-serif"
  }}>
    <div style={{
      width: '48px',
      height: '48px',
      border: '3px solid rgba(228, 0, 43, 0.2)',
      borderTop: '3px solid #E4002B',
      borderRadius: '50%',
      animation: 'sbSpin 0.8s linear infinite',
      marginBottom: '16px'
    }} />
    <style>{`@keyframes sbSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.05em' }}>
      LOADING SMART-BITE...
    </div>
  </div>
);

function App() {
  return (
    <CartProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<BrandedLoadingSpinner />}>
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
            
            <Route path="/vendor" element={<VendorDashboard />} />
            <Route path="/vendor/:shopId" element={<VendorDashboard />} />
            <Route path="/owner/dashboard" element={<Navigate to="/vendor" replace />} />
            <Route path="/board" element={<PublicOrderBoard />} />
            <Route path="/admin" element={<AdminControlCenter />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
