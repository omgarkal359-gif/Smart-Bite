import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingBag, Store, Users, Settings, ShieldAlert, ArrowRight, X, Command, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../api';
import { SHOPS } from '../../data/foodCourtDB';

export const CmdKSearchModal = ({ isOpen, onClose, onNavigateModule, onLogout }) => {
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      loadSearchData();
    } else {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  async function loadSearchData() {
    try {
      const allOrders = await api.getOrderQueue();
      setOrders(allOrders || []);
    } catch (e) {
      console.warn('CmdK order load:', e);
    }
  }

  // Filter items based on query
  const q = query.toLowerCase().trim();

  // Actions
  const navActions = [
    { type: 'nav', id: 'nav-overview', label: 'Go to Overview Dashboard', category: 'Quick Action', icon: Command, module: 'overview' },
    { type: 'nav', id: 'nav-orders', label: 'Manage All Campus Orders', category: 'Quick Action', icon: ShoppingBag, module: 'orders' },
    { type: 'nav', id: 'nav-shops', label: 'Manage Campus Shops & Vendors', category: 'Quick Action', icon: Store, module: 'orders' },
    { type: 'nav', id: 'nav-users', label: 'Manage Users & Permissions', category: 'Quick Action', icon: Users, module: 'users' },
    { type: 'nav', id: 'nav-config', label: 'Platform Config & Emergency Overrides', category: 'Quick Action', icon: Settings, module: 'config' },
    { type: 'nav', id: 'nav-logs', label: 'View Realtime System Audit Logs', category: 'Quick Action', icon: ShieldAlert, module: 'logs' },
    { type: 'logout', id: 'act-logout', label: 'Sign Out / Logout of Admin', category: 'Auth Action', icon: LogOut },
  ].filter(a => !q || a.label.toLowerCase().includes(q) || (a.id === 'act-logout' && ('logout'.includes(q) || 'sign out'.includes(q))));

  // Stalls match
  const matchedStalls = SHOPS.filter(s => !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
    .map(s => ({ type: 'stall', id: s.id, label: s.name, category: `Stall · ${s.category}`, icon: Store, stallId: s.id }));

  // Orders match
  const matchedOrders = orders.filter(o => !q || (o.id && o.id.toString().toLowerCase().includes(q)) || (o.customerName && o.customerName.toLowerCase().includes(q)))
    .slice(0, 5)
    .map(o => ({ type: 'order', id: o.id, label: `Order #${o.id} — ${o.customerName || 'Customer'} (₹${o.total})`, category: `Order · ${o.status.toUpperCase()}`, icon: ShoppingBag, orderId: o.id }));

  const allResults = [...navActions, ...matchedStalls, ...matchedOrders];

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, allResults.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + allResults.length) % Math.max(1, allResults.length));
    } else if (e.key === 'Enter' && allResults[selectedIndex]) {
      e.preventDefault();
      executeItem(allResults[selectedIndex]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const executeItem = (item) => {
    if (item.type === 'nav') {
      onNavigateModule(item.module);
    } else if (item.type === 'logout') {
      if (onLogout) onLogout();
    } else if (item.type === 'stall') {
      onNavigateModule('orders');
    } else if (item.type === 'order') {
      onNavigateModule('orders');
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="cmdk-backdrop" onClick={onClose}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.15 }}
          className="cmdk-modal"
          onClick={e => e.stopPropagation()}
        >
          <div className="cmdk-input-wrap">
            <Search size={20} color="#64748B" />
            <input 
              ref={inputRef}
              className="cmdk-input"
              placeholder="Search orders, stalls, users or type a command..."
              value={query}
              onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
              onKeyDown={handleKeyDown}
            />
            <button 
              onClick={onClose} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>

          <div className="cmdk-results">
            {allResults.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '0.875rem' }}>
                No results found for &quot;{query}&quot;
              </div>
            ) : (
              allResults.map((item, idx) => {
                const IconComponent = item.icon;
                const isSelected = idx === selectedIndex;

                return (
                  <div
                    key={`${item.type}-${item.id}-${idx}`}
                    className={`cmdk-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: isSelected ? 'rgba(255,59,92,0.12)' : '#F1F5F9', color: isSelected ? '#FF3B5C' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconComponent size={15} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: isSelected ? '#FF3B5C' : '#0F172A' }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#94A3B8' }}>
                          {item.category}
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={14} color={isSelected ? '#FF3B5C' : '#CBD5E1'} />
                  </div>
                );
              })
            )}
          </div>
          <div style={{ background: '#F8FAFC', padding: '10px 18px', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
            <span>Navigation: ↑↓ to navigate, Enter to select</span>
            <span>Esc to cancel</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
