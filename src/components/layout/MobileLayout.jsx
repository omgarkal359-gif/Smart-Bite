import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { ShoppingCart, Compass, Receipt, User, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../../context/CartContext';
import { CheckoutDrawer } from '../ui/CheckoutDrawer';
import { supabase } from '../../supabaseClient';
import { clearStoredUser } from '../../utils/auth';
import sguLogo from '../../assets/sgu-logo.jpg';

export const MobileLayout = () => {
  const navigate = useNavigate();
  const { totalItems, cart, isCheckoutOpen, setIsCheckoutOpen, showToast } = useCart();

  const handleStudentSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (_e) {}
    clearStoredUser();
    showToast('Signed out successfully! 👋', 'info');
    navigate('/login', { replace: true });
  };

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

        {/* Header Right Action Area: Sign Out Button Next To Add To Cart Button */}
        <div className="global-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            type="button"
            className="global-signout-btn tap-effect" 
            onClick={handleStudentSignOut}
            title="Sign Out of Account"
            style={{
              padding: '8px 14px',
              borderRadius: '999px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: '#FFF5F5',
              color: '#DC2626',
              fontSize: '0.82rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)'
            }}
          >
            <LogOut size={15} />
            <span style={{ fontFamily: "'Outfit', 'Plus Jakarta Sans', sans-serif" }}>Sign Out</span>
          </button>

          <button className="global-cart-btn tap-effect" onClick={() => {
            if (totalItems === 0) {
              navigate('/student/cart');
            } else {
              setIsCheckoutOpen(true);
            }
          }}>
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
        </div>
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

