import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { ShoppingCart, Compass, Receipt, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import { CheckoutDrawer } from '../ui/CheckoutDrawer';
import sguLogo from '../../assets/sgu-logo.jpg';

export const MobileLayout = () => {
  const navigate = useNavigate();
  const { totalItems, cart, isCheckoutOpen, setIsCheckoutOpen } = useCart();

  return (
    <div className="mobile-layout pb-nav bg-soft-gray">
      {/* Global Fixed Header */}
      <header className="global-fixed-header">
        <div className="sgu-sharp-logo" onClick={() => navigate('/student')}>
          <img src={sguLogo} alt="SGU Logo" className="sgu-logo-img" />
        </div>
        
        {/* Desktop Navigation Links */}
        <nav className="desktop-nav">
          <NavLink to="/student" end className={({ isActive }) => `desktop-nav-item ${isActive ? 'active' : ''}`}>
            <Compass size={18} /> Explore
          </NavLink>
          <NavLink to="/student/orders" className={({ isActive }) => `desktop-nav-item ${isActive ? 'active' : ''}`}>
            <Receipt size={18} /> Orders
          </NavLink>
          <NavLink to="/student/profile" className={({ isActive }) => `desktop-nav-item ${isActive ? 'active' : ''}`}>
            <User size={18} /> Profile
          </NavLink>
        </nav>

        <button className="global-cart-btn tap-effect" style={{ background: 'var(--bg-soft-gray)', border: '1px solid #E2E8F0', color: 'var(--primary-navy)' }} onClick={() => navigate('/student/profile')}>
          <User size={22} />
        </button>
      </header>

      <div className="global-content-area page-transition">
        <Outlet />
      </div>
      
      <BottomNav />

      <CheckoutDrawer 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
        cart={cart} 
      />
    </div>
  );
};
