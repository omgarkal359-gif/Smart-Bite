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
    <div className="mobile-layout pb-nav page-transition bg-soft-gray">
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

        <button className="global-cart-btn tap-effect" onClick={() => setIsCheckoutOpen(true)}>
          <ShoppingCart size={22} />
          <AnimatePresence>
            {totalItems > 0 && (
              <motion.span 
                className="global-cart-badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                {totalItems}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </header>

      <div className="global-content-area">
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
