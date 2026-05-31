import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, Search, Receipt, User, ShoppingCart } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { api, socket } from '../../api';
import { motion } from 'framer-motion';
import './layout.css';

export const BottomNav = () => {
  const { totalItems } = useCart();
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
    
    return () => {
      socket.off('order_new_student', fetchActiveCount);
      socket.off('order_status_update', fetchActiveCount);
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
      <NavLink to="/student/cart" className={({ isActive }) => `nav-item tap-effect ${isActive ? 'active' : ''}`}>
        {({ isActive }) => (
          <motion.div className="nav-icon-wrapper relative" animate={{ scale: isActive ? 1.1 : 1 }} whileTap={{ scale: 0.9 }}>
            <ShoppingCart size={24} />
            {badgeCount > 0 && (
              <span className={`cart-badge-v21 ${hasActiveOrders ? 'glowing-active-badge' : ''}`}>
                {badgeCount}
              </span>
            )}
            <span>Cart</span>
          </motion.div>
        )}
      </NavLink>
      <NavLink to="/student/profile" className={({ isActive }) => `nav-item tap-effect ${isActive ? 'active' : ''}`}>
        {({ isActive }) => (
          <motion.div className="nav-icon-wrapper" animate={{ scale: isActive ? 1.1 : 1 }} whileTap={{ scale: 0.9 }}>
            <User size={24} />
            <span>Profile</span>
          </motion.div>
        )}
      </NavLink>
    </nav>
  );
};
