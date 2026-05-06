import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../../context/CartContext';

export const MobileLayout = () => {
  const navigate = useNavigate();
  const { totalItems: cartCount } = useCart(); 

  return (
    <div className="mobile-layout pb-nav page-transition bg-soft-gray">
      {/* Global Fixed Header */}
      <header className="global-fixed-header">
        <div className="sgu-sharp-logo" onClick={() => navigate('/student')}>
          SGU
        </div>
        
        <button className="global-cart-btn tap-effect" onClick={() => navigate('/student/cart')}>
          <ShoppingCart size={22} />
          <AnimatePresence>
            {cartCount > 0 && (
              <motion.span 
                className="global-cart-badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
              >
                {cartCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </header>

      <div className="global-content-area">
        <Outlet />
      </div>
      
      <BottomNav />
    </div>
  );
};
