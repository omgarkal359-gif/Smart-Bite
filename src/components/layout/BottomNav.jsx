import React from 'react';
import { NavLink } from 'react-router-dom';
import { Compass, Search, Receipt, User } from 'lucide-react';
import { motion } from 'framer-motion';
import './layout.css';

export const BottomNav = () => {
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
