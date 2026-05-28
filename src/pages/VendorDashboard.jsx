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
  const { shopId: urlShopId } = useParams();
  const [user, setUser] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Determine target shop ID (URL takes priority, then user profile)
  const targetShopId = urlShopId || user?.shopId;
  const currentShop = SHOPS.find(s => s.id === targetShopId);

  // Sync with Backend Orders
  const loadOrders = useCallback(async () => {
    if (!targetShopId) return;
    try {
      const allOrders = await api.getStallOrders(targetShopId);
      
      const active = allOrders.filter(order => order.status !== 'completed').map(order => ({
        ...order,
        items: typeof order.items === 'string' ? order.items.split(', ') : order.items
      }));

      const done = allOrders.filter(order => order.status === 'completed');

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
      if (updatedOrder.status === 'completed') {
        setTickets(prev => prev.filter(t => t.id !== updatedOrder.id));
        setCompletedTickets(prev => {
          if (prev.some(t => t.id === updatedOrder.id)) return prev;
          return [updatedOrder, ...prev];
        });
      } else {
        setTickets(prev => prev.map(t => t.id === updatedOrder.id ? { 
          ...t, 
          status: updatedOrder.status 
        } : t));
      }
    };

    socket.on('order_new', handleNewOrder);
    socket.on('order_status_update', handleStatusUpdate);

    return () => {
      socket.off('order_new', handleNewOrder);
      socket.off('order_status_update', handleStatusUpdate);
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
    if (parsedUser.role !== 'owner' && parsedUser.role !== 'admin') {
      navigate('/student');
      return;
    }
    setUser(parsedUser);

    // Initial stall status load
    api.getStalls()
      .then(stalls => {
        const stall = stalls.find(s => s.id === (urlShopId || parsedUser.shopId));
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
      
      if (newStatus === 'completed') {
        setTickets(prev => prev.filter(t => t.id !== id));
        const ticket = tickets.find(t => t.id === id);
        if (ticket) {
          setCompletedTickets(prev => [...prev, { ...ticket, status: 'completed', timestamp: new Date().toISOString() }]);
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
            <h1 className="heading-2 text-white text-3xl" style={{ margin: 0 }}>{currentShop?.name || 'Shop'} COMMAND</h1>
            <div className="heartbeat-monitor mt-1" style={{ padding: '4px 12px' }}>
              <Activity size={14} color={heartbeat ? '#22C55E' : '#94A3B8'} className={heartbeat ? 'pulse' : ''} />
              <span className="text-white opacity-80 text-[10px] uppercase font-black tracking-widest">Live Operations</span>
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
            {tickets.map(ticket => (
              <motion.div 
                key={ticket.id}
                layout
                initial={{ opacity: 0, scale: 0.8, x: 50 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: -50 }}
                className={`elite-card kds-ticket ${ticket.status === 'pending_cash' ? 'border-amber-400 border-2' : ''}`}
              >
                <div className="ticket-header">
                  <div className="flex flex-col">
                    <span className="ticket-id text-2xl">{ticket.id}</span>
                    <span className="text-[10px] font-black text-navy-400 uppercase tracking-widest">{ticket.customerName || 'Standard Order'}</span>
                  </div>
                  <span className="ticket-time text-red-500 font-black uppercase text-xs tracking-tighter">{ticket.time}</span>
                </div>
                
                <div className="ticket-badges">
                  <span className={`badge ${ticket.type === 'Dine-In' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                    {ticket.type === 'Dine-In' ? <Utensils size={14} /> : <ShoppingBag size={14} />}
                    {ticket.type}
                  </span>
                  <span className={`badge ${ticket.payment === 'Online UPI' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {ticket.payment === 'Online UPI' ? <Smartphone size={14} /> : <Banknote size={14} />}
                    {ticket.payment}
                  </span>
                </div>

                <div className="ticket-items">
                  {ticket.items.map((item, i) => (
                    <div key={i} className="ticket-item font-bold text-slate-700">{item}</div>
                  ))}
                </div>

                <div className="ticket-footer mt-auto pt-4 border-t border-dashed border-slate-200">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase block">Order Total</span>
                      <span className="text-xl font-black text-navy-900">₹{ticket.total}</span>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded ${
                      ticket.status === 'preparing' ? 'bg-blue-100 text-blue-700' : 
                      ticket.status === 'ready' ? 'bg-green-100 text-green-700' :
                      ticket.status === 'placed' ? 'bg-purple-100 text-purple-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {ticket.status === 'preparing' ? 'PREPARING' : 
                       ticket.status === 'ready' ? 'READY' :
                       ticket.status === 'placed' ? 'NEW ORDER' :
                       'AWAITING CASH'}
                    </span>
                  </div>

                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`jumbo-btn ${
                      ticket.status === 'pending_cash' ? 'bg-amber-500' : 
                      ticket.status === 'placed' ? 'bg-purple-600' :
                      ticket.status === 'preparing' ? 'bg-blue-600' :
                      'bg-green-500'
                    }`}
                    onClick={() => {
                      if (ticket.status === 'pending_cash') handleConfirmCash(ticket.id);
                      else if (ticket.status === 'placed') handleUpdateStatus(ticket.id, 'preparing');
                      else if (ticket.status === 'preparing') handleUpdateStatus(ticket.id, 'ready');
                      else handleUpdateStatus(ticket.id, 'completed');
                    }}
                  >
                    <CheckCircle size={20} />
                    {ticket.status === 'pending_cash' ? 'CONFIRM CASH' : 
                     ticket.status === 'placed' ? 'START PREPARING' :
                     ticket.status === 'preparing' ? 'MARK AS READY' :
                     'MARK COMPLETED'}
                  </motion.button>
                </div>
              </motion.div>
            ))}
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
              <div className="flex justify-between items-center mb-8 border-b pb-6">
                <h2 className="heading-2 text-3xl text-navy-900" style={{ margin: 0 }}>OPERATIONS</h2>
                <button className="p-3 hover:bg-slate-200 rounded-full transition-colors" onClick={() => setIsSidebarOpen(false)}>
                  <X size={28} />
                </button>
              </div>
              <MenuEditor shopId={targetShopId} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VendorDashboard;
