import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ShopDirectory from './pages/ShopDirectory';
import InteractiveMenu from './pages/InteractiveMenu';
import DigitalReceiptTracker from './pages/DigitalReceiptTracker';
import VendorDashboard from './pages/VendorDashboard';
import PublicOrderBoard from './pages/PublicOrderBoard';
import AdminControlCenter from './pages/AdminControlCenter';
import UserProfile from './pages/UserProfile';
import SearchPage from './pages/SearchPage';
import OrdersPage from './pages/OrdersPage';
import LoginPage from './pages/LoginPage';
import CartPage from './pages/CartPage';
import { MobileLayout } from './components/layout/MobileLayout';
import { CartProvider } from './context/CartContext';

function App() {
  return (
    <CartProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        
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
        <Route path="/owner/dashboard" element={<Navigate to="/vendor" replace />} />
        <Route path="/board" element={<PublicOrderBoard />} />
        <Route path="/admin" element={<AdminControlCenter />} />
      </Routes>
    </BrowserRouter>
    </CartProvider>
  );
}

export default App;
