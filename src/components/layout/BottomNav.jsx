import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, Receipt, User } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { supabase } from '../../supabaseClient';
import { motion } from 'framer-motion';
import './layout.css';

export const BottomNav = () => {
  const { totalItems } = useCart();
  const [activeOrdersCount, setActiveOrdersCount] = useState(0);
  const [userId, setUserId] = useState(null);

  // Securely fetch userId from Supabase session (no localStorage)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    if (!userId) return;

    async function fetchActiveCount() {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('id, status')
          .eq('customer_id', userId)
          .in('status', ['placed', 'preparing', 'ready']);
        if (!error) setActiveOrdersCount(data?.length || 0);
      } catch (err) {
        console.error('Failed to fetch active orders for nav badge:', err);
      }
    }

    fetchActiveCount();

    // Supabase Realtime subscription for instant badge updates
    const channel = supabase
      .channel(`student-nav-orders-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `customer_id=eq.${userId}`
      }, () => {
        fetchActiveCount();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

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
