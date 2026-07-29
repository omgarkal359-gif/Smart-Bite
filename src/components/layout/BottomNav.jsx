import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Compass, Search, Receipt, User, ShoppingCart } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { api, socket } from '../../api';
import { motion } from 'framer-motion';
import './layout.css';

export const BottomNav = () => {
  const { totalItems, setIsCheckoutOpen } = useCart();
  const navigate = useNavigate();
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);

  const userData = JSON.parse(localStorage.getItem('sgu_user') || '{}');

  useEffect(() => {
    if (!userData.id) return;
    
    async function fetchActiveCount() {
      try {
        const orders = await api.getStudentOrders(userData.id);
        const active = orders.filter(o => ['placed', 'preparing', 'ready', 'pending_cash'].includes(o.status));
        setActiveOrdersCount(active.length);
      } catch (err) {
        console.error('Failed to fetch active orders for nav badge:', err);
      }
    }
    
    fetchActiveCount();
    
    // Listen to real-time socket updates to instantly change the badge!
    socket.emit('join', 'student');
    socket.on('order_new_student', fetchActiveCount);
    socket.on('order_status_update', fetchActiveCount);
    
    // Polling fallback
    const interval = setInterval(fetchActiveCount, 15000); // Poll every 15 seconds

    return () => {
      socket.off('order_new_student', fetchActiveCount);
      socket.off('order_status_update', fetchActiveCount);
      clearInterval(interval);
    };
  }, [userData.id]);

  const badgeCount = totalItems + activeOrdersCount;
  const hasActiveOrders = activeOrdersCount > 0;

  return (
    <nav className="bottom-nav shadow-2xl">
      <NavLink to="/student" end className={({ isActive }) => `nav-item tap-effect ${isActive ? 'active' : ''}`}>
        {({ isActive }) => (
          <motion.div className="nav-icon-wrapper" animate={{ scale: isActive ? 1.1 : 1 }} whileTap={{ scale: 0.9 }}>
            <Compass size={24} />
            <span>Explore</span>
          </motion.div>
        )}
      </NavLink>

      <NavLink to="/student/orders" className={({ isActive }) => `nav-item tap-effect ${isActive ? 'active' : ''}`}>
        {({ isActive }) => (
          <motion.div className="nav-icon-wrapper" animate={{ scale: isActive ? 1.1 : 1 }} whileTap={{ scale: 0.9 }}>
            <Receipt size={24} />
            <span>Orders</span>
          </motion.div>
        )}
      </NavLink>

      <div 
        className={`nav-item tap-effect ${window.location.pathname.includes('/cart') ? 'active' : ''}`}
        onClick={() => {
          if (totalItems === 0) {
            navigate('/student/cart');
          } else {
            setIsCheckoutOpen(true);
          }
        }}
        style={{ cursor: 'pointer' }}
      >
        <motion.div className="nav-icon-wrapper" whileTap={{ scale: 0.9 }}>
          <div style={{ position: 'relative' }}>
            <ShoppingCart size={24} />
            {totalItems > 0 && (
              <span style={{ position: 'absolute', top: -6, right: -10, background: 'var(--error-red)', color: 'white', fontSize: '0.65rem', fontWeight: 800, width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {totalItems}
              </span>
            )}
          </div>
          <span>Cart</span>
        </motion.div>
      </div>
    </nav>
  );
};
