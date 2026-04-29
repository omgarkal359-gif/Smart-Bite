import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthGateway from './pages/AuthGateway';
import ShopDirectory from './pages/ShopDirectory';
import InteractiveMenu from './pages/InteractiveMenu';
import DigitalReceiptTracker from './pages/DigitalReceiptTracker';
import VendorDashboard from './pages/VendorDashboard';
import PublicOrderBoard from './pages/PublicOrderBoard';
import AdminControlCenter from './pages/AdminControlCenter';
import UserProfile from './pages/UserProfile';
import SearchPage from './pages/SearchPage';
import OrdersPage from './pages/OrdersPage';
import { MobileLayout } from './components/layout/MobileLayout';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<AuthGateway />} />
        
        {/* Student Routes with Mobile Layout wrapper */}
        <Route path="/student" element={<MobileLayout />}>
          <Route index element={<ShopDirectory />} />
          <Route path="shop/:shopId" element={<InteractiveMenu />} />
          <Route path="order/:orderId" element={<DigitalReceiptTracker />} />
          <Route path="profile" element={<UserProfile />} />
          <Route path="search" element={<SearchPage />} /> 
          <Route path="orders" element={<OrdersPage />} />
        </Route>
        
        <Route path="/vendor" element={<VendorDashboard />} />
        <Route path="/board" element={<PublicOrderBoard />} />
        <Route path="/admin" element={<AdminControlCenter />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
