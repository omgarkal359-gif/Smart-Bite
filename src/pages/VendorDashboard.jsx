import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Clock, Volume2, Power, LogOut, CheckCircle, Banknote, Activity, Smartphone, Utensils, ShoppingBag, Settings, Menu, RefreshCw, X, TrendingUp, Hash, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MenuEditor } from '../components/vendor/MenuEditor';
import { SHOPS } from '../data/foodCourtDB';
import { api, socket } from '../api';
import './pages.css';
import './vendor.css';

const MOCK_TICKETS = [];

const COMPLETED_TICKETS_MOCK = [];

const VendorDashboard = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [completedTickets, setCompletedTickets] = useState([]);
  const [isPowerSaver, setIsPowerSaver] = useState(false);
  const [isBusyMode, setIsBusyMode] = useState(false);
  const [heartbeat, setHeartbeat] = useState(true);
  const [shopStatus, setShopStatus] = useState('OPEN'); // OPEN | CLOSED
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState('menu'); // 'menu' | 'history'
  const { shopId: urlShopId } = useParams();
  const cleanUrlShopId = (urlShopId && urlShopId !== 'undefined' && urlShopId !== 'null') ? urlShopId : null;
  const [user, setUser] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Determine target shop ID (URL takes priority, then user profile)
  const targetShopId = cleanUrlShopId || user?.shopId || user?.shopid;
  const currentShop = SHOPS.find(s => s.id === targetShopId);

  // Sync with Backend Orders
  const loadOrders = useCallback(async () => {
    if (!targetShopId) return;
    try {
      const allOrders = await api.getStallOrders(targetShopId);
      
      const active = allOrders.filter(order => order.status !== 'completed' && order.status !== 'ready').map(order => ({
        ...order,
        items: typeof order.items === 'string' ? order.items.split(', ') : order.items
      }));

      const done = allOrders.filter(order => order.status === 'completed' || order.status === 'ready');

      setTickets(active);
      setCompletedTickets(done);
    } catch (err) {
      console.error('Failed to load stall orders:', err);
    }
  }, [targetShopId]);

  useEffect(() => {
    if (!targetShopId) return;

    loadOrders();
    
    // Join room for this vendor
    socket.emit('join', `vendor-${targetShopId}`);

    const handleNewOrder = (newOrder) => {
      setTickets(prev => {
        if (prev.some(t => t.id === newOrder.id)) return prev;
        // Format item split
        const formatted = {
          ...newOrder,
          items: typeof newOrder.items === 'string' ? newOrder.items.split(', ') : newOrder.items
        };
        return [formatted, ...prev];
      });
    };

    const handleStatusUpdate = (updatedOrder) => {
      if (updatedOrder.status === 'completed' || updatedOrder.status === 'ready') {
        setTickets(prev => prev.filter(t => t.id !== updatedOrder.id));
        setCompletedTickets(prev => {
          const formatted = {
            ...updatedOrder,
            items: typeof updatedOrder.items === 'string' ? updatedOrder.items.split(', ') : updatedOrder.items
          };
          if (prev.some(t => t.id === updatedOrder.id)) {
            return prev.map(t => t.id === updatedOrder.id ? formatted : t);
          }
          return [formatted, ...prev];
        });
      } else {
        setTickets(prev => {
          if (prev.some(t => t.id === updatedOrder.id)) {
            return prev.map(t => t.id === updatedOrder.id ? { 
              ...t, 
              status: updatedOrder.status 
            } : t);
          }
          const formatted = {
            ...updatedOrder,
            items: typeof updatedOrder.items === 'string' ? updatedOrder.items.split(', ') : updatedOrder.items
          };
          return [formatted, ...prev];
        });
      }
    };

    socket.on('order_new', handleNewOrder);
    socket.on('order_status_update', handleStatusUpdate);

    // Polling fallback (poll every 2 seconds for instant order updates)
    const intervalTime = 2000;
    const interval = setInterval(loadOrders, intervalTime);

    return () => {
      socket.off('order_new', handleNewOrder);
      socket.off('order_status_update', handleStatusUpdate);
      clearInterval(interval);
    };
  }, [targetShopId, loadOrders]);

  // Security Gate & Session Check
  useEffect(() => {
    const userData = localStorage.getItem('sgu_user');
    if (!userData) {
      navigate('/login');
      return;
    }
    const parsedUser = JSON.parse(userData);
    
    // Self-healing session check for corrupted owner sessions from previous bugs
    const isOwnerSessionCorrupted = parsedUser.role === 'owner' && 
      (!parsedUser.shopId || parsedUser.shopId === 'undefined' || parsedUser.shopId === 'null');
      
    if (isOwnerSessionCorrupted) {
      console.warn('Clearing corrupted owner session on VendorDashboard:', parsedUser);
      localStorage.removeItem('sgu_user');
      navigate('/login', { replace: true });
      return;
    }

    if (parsedUser.role !== 'owner' && parsedUser.role !== 'admin') {
      navigate('/student');
      return;
    }

    const userShopId = parsedUser.shopId || parsedUser.shopid;

    // If owner tries to access without a shopId in URL, redirect to their own shop
    if (parsedUser.role === 'owner' && !cleanUrlShopId && userShopId) {
      navigate(`/vendor/${userShopId}`, { replace: true });
      return;
    }

    // Security: owners can only access their own shop's dashboard
    if (parsedUser.role === 'owner' && cleanUrlShopId && userShopId && cleanUrlShopId !== userShopId) {
      navigate(`/vendor/${userShopId}`, { replace: true });
      return;
    }

    setUser(parsedUser);

    // Initial stall status load
    api.getStalls()
      .then(stalls => {
        const stall = stalls.find(s => s.id === (cleanUrlShopId || userShopId));
        if (stall) {
          setShopStatus(stall.online === 1 || stall.online === true ? 'OPEN' : 'CLOSED');
          setIsBusyMode(stall.busyMode === 1 || stall.busyMode === true);
        }
      })
      .catch(console.error);
  }, [navigate, urlShopId]);

  // Today's Metrics Calculation
  const metrics = useMemo(() => {
    const today = new Date().toDateString();
    const todayCompleted = completedTickets.filter(t => new Date(t.timestamp).toDateString() === today);
    
    const totalOrders = todayCompleted.length + tickets.length;
    const totalRevenue = todayCompleted.reduce((sum, t) => sum + t.total, 0);
    const cashRevenue = todayCompleted.filter(t => t.payment === 'Cash').reduce((sum, t) => sum + t.total, 0);
    const upiRevenue = todayCompleted.filter(t => t.payment === 'Online UPI').reduce((sum, t) => sum + t.total, 0);

    return { totalOrders, totalRevenue, cashRevenue, upiRevenue };
  }, [tickets, completedTickets]);

  const handleToggleShop = async () => {
    const newStatus = shopStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    try {
      if (targetShopId) {
        await api.updateStallStatus(targetShopId, { online: newStatus === 'OPEN' });
      }
      setShopStatus(newStatus);
      if (newStatus === 'OPEN') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
    } catch (err) {
      alert('Failed to update shop status: ' + err.message);
    }
  };

  const handleToggleBusy = async () => {
    const nextBusy = !isBusyMode;
    const nextWait = nextBusy ? 15 : 0;
    try {
      if (targetShopId) {
        await api.updateStallStatus(targetShopId, { busyMode: nextBusy, waitTime: nextWait });
      }
      setIsBusyMode(nextBusy);
    } catch (err) {
      alert('Failed to toggle busy mode: ' + err.message);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await api.updateOrderStatus(id, newStatus);
      
      if (newStatus === 'completed' || newStatus === 'ready') {
        setTickets(prev => prev.filter(t => t.id !== id));
        const ticket = tickets.find(t => t.id === id);
        if (ticket) {
          setCompletedTickets(prev => {
            if (prev.some(t => t.id === id)) {
              return prev.map(t => t.id === id ? { ...t, status: newStatus } : t);
            }
            return [{ ...ticket, status: newStatus, timestamp: new Date().toISOString() }, ...prev];
          });
        }
      } else {
        setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
      }
    } catch (err) {
      alert('Failed to update order status: ' + err.message);
    }
  };

  const handleConfirmCash = (id) => handleUpdateStatus(id, 'placed');

  return (
    <div className={`vendor-kds-container page-transition ${isPowerSaver ? 'power-saver' : ''}`}>
      {/* Confetti Effect */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-[1000] flex items-center justify-center">
            {[...Array(20)].map((_, i) => (
              <motion.span
                key={i}
                initial={{ scale: 0, x: 0, y: 0 }}
                animate={{ 
                  scale: [0, 1, 0], 
                  x: (Math.random() - 0.5) * 1000, 
                  y: (Math.random() - 0.5) * 1000,
                  rotate: Math.random() * 360
                }}
                className="text-4xl absolute"
              >
                {['🍕', '🍔', '🍟', '✨', '🔥'][Math.floor(Math.random() * 5)]}
              </motion.span>
            ))}
          </div>
        )}
      </AnimatePresence>

      <header className={`kds-header shadow-lg ${shopStatus === 'CLOSED' ? 'closed' : ''}`}>
        <div className="kds-header-left flex items-center gap-8">
          <div className="flex flex-col">
            <h1 className="heading-2 text-white text-3xl" style={{ margin: 0 }}>{currentShop?.name || 'Vendor Dashboard'}</h1>
            <div className="heartbeat-monitor mt-1" style={{ padding: '4px 12px' }}>
              <Activity size={14} color={heartbeat ? '#22C55E' : '#94A3B8'} className={heartbeat ? 'pulse' : ''} />
              <span className="text-white opacity-80 text-[10px] uppercase font-black tracking-widest">Live Operations</span>
              {user && <span className="text-white opacity-60 text-[10px] font-semibold ml-2">· {user.name}</span>}
            </div>
          </div>

          {/* Premium Status Toggle */}
          <div className="status-toggle-container">
            <div 
              className={`premium-switch ${shopStatus === 'CLOSED' ? 'closed' : ''}`}
              onClick={handleToggleShop}
            >
              <div className="switch-label">
                <span>OPEN</span>
                <span>CLOSED</span>
              </div>
              <motion.div 
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="switch-knob"
                style={{ x: shopStatus === 'CLOSED' ? 56 : 0 }}
              >
                {shopStatus}
              </motion.div>
            </div>
          </div>
        </div>
        
        <div className="kds-controls flex items-center gap-3">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`elite-ctrl-btn ${isBusyMode ? 'busy' : ''}`} 
            onClick={handleToggleBusy}
          >
            <Clock size={18} /> <span>{isBusyMode ? 'BUSY' : 'NORMAL'}</span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`elite-ctrl-btn ${isPowerSaver ? 'active' : ''}`} 
            onClick={() => setIsPowerSaver(!isPowerSaver)}
          >
            <Power size={18} /> <span>SAVER</span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="elite-ctrl-btn management" 
            onClick={() => setIsSidebarOpen(true)}
          >
            <Settings size={18} /> <span>MANAGEMENT</span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="elite-ctrl-btn exit" 
            onClick={() => {
              localStorage.removeItem('sgu_user');
              localStorage.removeItem('sgu_token');
              navigate('/login', { replace: true });
            }}
          >
            <LogOut size={18} /> <span>EXIT</span>
          </motion.button>
        </div>
      </header>

      <main className="kds-main relative">
        {/* Closed Watermark */}
        <div className={`closed-watermark ${shopStatus === 'CLOSED' ? 'visible' : ''}`}>
          <div className="watermark-text">SHOP CLOSED</div>
        </div>

        {/* Admin Command Dashboard */}
        <div className="command-grid">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="elite-card command-card">
            <div className="flex justify-between items-start">
              <span className="command-label">Today&apos;s Orders</span>
              <Hash size={20} className="text-navy-400" />
            </div>
            <span className="command-value">{metrics.totalOrders}</span>
            <span className="command-subvalue flex items-center gap-1"><TrendingUp size={12}/> Live Session</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="elite-card command-card">
            <div className="flex justify-between items-start">
              <span className="command-label">Today&apos;s Revenue</span>
              <TrendingUp size={20} className="text-green-500" />
            </div>
            <span className="command-value">₹{metrics.totalRevenue}</span>
            <span className="command-subvalue">Combined Total</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="elite-card command-card">
            <div className="flex justify-between items-start">
              <span className="command-label">Cash Collection</span>
              <Banknote size={20} className="text-amber-500" />
            </div>
            <span className="command-value">₹{metrics.cashRevenue}</span>
            <span className="command-subvalue text-amber-600">Pending & Collected</span>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="elite-card command-card">
            <div className="flex justify-between items-start">
              <span className="command-label">UPI Collection</span>
              <Smartphone size={20} className="text-blue-500" />
            </div>
            <span className="command-value">₹{metrics.upiRevenue}</span>
            <span className="command-subvalue text-blue-600">Auto-Verified</span>
          </motion.div>
        </div>

        {/* Horizontal Ticket Scroll */}
        <div className="kds-ticket-scroll">
          <AnimatePresence>
            {tickets.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center w-full py-24 gap-4 text-center"
              >
                <div style={{ fontSize: 64 }}>🍽️</div>
                <p style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.4rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                  No Active Orders
                </p>
                <p style={{ color: '#94A3B8', fontSize: '0.875rem', fontWeight: 600 }}>
                  New orders from customers will appear here instantly
                </p>
              </motion.div>
            )}
            {tickets.map(ticket => {
              // Parse items: could be "1x Dosa, 2x Tea" string or an array of strings or objects
              let parsedItems = [];
              if (Array.isArray(ticket.items)) {
                parsedItems = ticket.items;
              } else if (typeof ticket.items === 'string') {
                parsedItems = ticket.items.split(', ').filter(Boolean);
              }

              // Use originalItems for rich display if available
              const richItems = ticket.originalItems && Array.isArray(ticket.originalItems) ? ticket.originalItems : null;

              const isNew = ticket.status === 'placed';
              const isPreparing = ticket.status === 'preparing';
              const isPendingCash = ticket.status === 'pending_cash';
              const isReady = ticket.status === 'ready';

              const statusColor = isPreparing ? '#3B82F6' : isReady ? '#22C55E' : isNew ? '#8B5CF6' : '#F59E0B';
              const statusLabel = isPreparing ? '🔥 PREPARING' : isReady ? '✅ READY' : isNew ? '🆕 NEW ORDER' : '💵 AWAITING CASH';

              return (
                <motion.div
                  key={ticket.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85, x: 60 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -50 }}
                  className={`elite-card kds-ticket`}
                  style={{ borderTop: `4px solid ${statusColor}` }}
                >
                  {/* Pulsing NEW badge */}
                  {(isNew || isPendingCash) && (
                    <div style={{
                      position: 'absolute', top: 12, right: 12,
                      background: isNew ? '#8B5CF6' : '#F59E0B',
                      color: 'white', borderRadius: 8, padding: '3px 10px',
                      fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.15em',
                      fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase',
                      animation: 'pulse 1.5s infinite'
                    }}>
                      {isNew ? 'NEW' : 'CASH'}
                    </div>
                  )}

                  {/* Header */}
                  <div className="ticket-header">
                    <div className="flex flex-col">
                      <span className="ticket-id" style={{ fontSize: '1.4rem' }}>#{ticket.id}</span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {ticket.customerName || 'Standard Order'}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#E4002B', textTransform: 'uppercase', fontFamily: "'Oswald', sans-serif" }}>
                      {ticket.time || 'Just now'}
                    </span>
                  </div>

                  {/* Badges */}
                  <div className="ticket-badges">
                    <span className={`badge ${ticket.type === 'Dine-In' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {ticket.type === 'Dine-In' ? <Utensils size={13} /> : <ShoppingBag size={13} />}
                      {ticket.type || 'Dine-In'}
                    </span>
                    <span className={`badge ${ticket.payment === 'Online UPI' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {ticket.payment === 'Online UPI' ? <Smartphone size={13} /> : <Banknote size={13} />}
                      {ticket.payment || 'Cash'}
                    </span>
                  </div>

                  {/* Items List */}
                  <div className="ticket-items">
                    {richItems ? (
                      richItems.map((item, i) => (
                        <div key={i} className="ticket-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#F8FAFC', borderRadius: 10, borderLeft: 'none', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ background: '#1A5276', color: 'white', borderRadius: 6, padding: '2px 7px', fontSize: '0.7rem', fontWeight: 900, fontFamily: "'Oswald', sans-serif" }}>
                              ×{item.quantity || 1}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0F172A' }}>{item.name}</span>
                          </div>
                          <span style={{ fontWeight: 800, color: '#1A5276', fontSize: '0.85rem', fontFamily: "'Oswald', sans-serif" }}>
                            ₹{(item.price || 0) * (item.quantity || 1)}
                          </span>
                        </div>
                      ))
                    ) : (
                      parsedItems.map((item, i) => (
                        <div key={i} className="ticket-item" style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: 10, borderLeft: 'none', fontWeight: 700, color: '#0F172A', fontSize: '0.85rem', marginBottom: 6 }}>
                          {item}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '2px dashed #E2E8F0' }}>
                    {/* Total + Status */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#94A3B8', textTransform: 'uppercase', display: 'block', letterSpacing: '0.1em' }}>Order Total</span>
                        <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>₹{ticket.total}</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', fontWeight: 900, padding: '5px 10px', borderRadius: 8, background: `${statusColor}18`, color: statusColor, fontFamily: "'Oswald', sans-serif", letterSpacing: '0.05em' }}>
                        {statusLabel}
                      </span>
                    </div>

                    {/* Action Buttons */}
                    {(isNew || isPreparing) && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <motion.button
                          whileHover={{ scale: isPreparing ? 1 : 1.04 }}
                          whileTap={{ scale: isPreparing ? 1 : 0.96 }}
                          disabled={isPreparing}
                          onClick={() => handleUpdateStatus(ticket.id, 'preparing')}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '14px 0', borderRadius: 14, border: 'none', cursor: isPreparing ? 'not-allowed' : 'pointer',
                            fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.05em', textTransform: 'uppercase',
                            background: isPreparing ? '#F1F5F9' : 'linear-gradient(135deg, #F59E0B, #D97706)',
                            color: isPreparing ? '#94A3B8' : 'white',
                            boxShadow: isPreparing ? 'none' : '0 4px 14px rgba(245,158,11,0.4)',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Clock size={18} color={isPreparing ? '#94A3B8' : 'white'} />
                          {isPreparing ? 'Preparing…' : 'Preparing'}
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => handleUpdateStatus(ticket.id, 'ready')}
                          style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '14px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
                            fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.9rem', letterSpacing: '0.05em', textTransform: 'uppercase',
                            background: 'linear-gradient(135deg, #22C55E, #16A34A)',
                            color: 'white',
                            boxShadow: '0 4px 14px rgba(34,197,94,0.4)',
                            transition: 'all 0.2s'
                          }}
                        >
                          <CheckCircle size={18} color="white" />
                          Ready
                        </motion.button>
                      </div>
                    )}

                    {isPendingCash && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleConfirmCash(ticket.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                          padding: '16px', borderRadius: 16, border: 'none', cursor: 'pointer',
                          fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase',
                          background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                          color: 'white',
                          boxShadow: '0 6px 20px rgba(245,158,11,0.4)',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Banknote size={22} color="white" />
                        Confirm Cash
                      </motion.button>
                    )}

                    {isReady && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleUpdateStatus(ticket.id, 'completed')}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                          padding: '16px', borderRadius: 16, border: 'none', cursor: 'pointer',
                          fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '1rem', letterSpacing: '0.05em', textTransform: 'uppercase',
                          background: 'linear-gradient(135deg, #22C55E, #15803D)',
                          color: 'white',
                          boxShadow: '0 6px 20px rgba(34,197,94,0.45)',
                        }}
                      >
                        <CheckCircle size={22} />
                        Mark Completed
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </main>


      {/* Sidebar Drawer */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
            <motion.div 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }} 
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="management-sidebar open shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6 border-b pb-4">
                <h2 className="heading-2 text-3xl text-navy-900" style={{ margin: 0 }}>OPERATIONS</h2>
                <button className="p-3 hover:bg-slate-200 rounded-full transition-colors" onClick={() => setIsSidebarOpen(false)}>
                  <X size={28} />
                </button>
              </div>

              {/* Tab Selector */}
              <div className="flex gap-2 mb-6 border-b pb-4">
                <button 
                  className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer border-none transition-all ${
                    activeSidebarTab === 'menu' 
                      ? 'bg-[#1A5276] text-white shadow-md' 
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                  onClick={() => setActiveSidebarTab('menu')}
                >
                  Menu Editor
                </button>
                <button 
                  className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider cursor-pointer border-none transition-all ${
                    activeSidebarTab === 'history' 
                      ? 'bg-[#1A5276] text-white shadow-md' 
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                  onClick={() => setActiveSidebarTab('history')}
                >
                  Order History ({completedTickets.length})
                </button>
              </div>

              {activeSidebarTab === 'menu' && (
                <MenuEditor shopId={targetShopId} />
              )}

              {activeSidebarTab === 'history' && (
                <div className="flex flex-col gap-4">
                  <h3 className="text-xl font-bold text-navy-900 mb-2">Ready & Completed Orders</h3>
                  {completedTickets.length === 0 ? (
                    <p className="text-slate-400 font-medium text-center py-8">No completed or ready orders yet.</p>
                  ) : (
                    completedTickets.map((order) => (
                      <GlassCard 
                        key={order.id}
                        style={{
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          background: 'rgba(255, 255, 255, 0.95)',
                          borderLeft: order.status === 'ready' ? '6px solid var(--success-green)' : '6px solid #94A3B8',
                          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-md text-navy-900">{order.id}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        
                        <p className="text-xs font-semibold text-slate-600 my-1">
                          {typeof order.items === 'string' 
                            ? order.items 
                            : Array.isArray(order.items) 
                              ? order.items.map(i => typeof i === 'string' ? i : `${i.quantity}x ${i.name}`).join(', ') 
                              : ''}
                        </p>

                        <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-100 mt-1">
                          <span className="font-bold text-navy-900">₹{order.total}</span>
                          <div className="flex gap-2">
                            <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-1 rounded">
                              {order.payment}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${
                              order.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                        </div>
                      </GlassCard>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VendorDashboard;
