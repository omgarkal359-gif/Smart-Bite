import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Clock, Volume2, Power, LogOut, CheckCircle, Banknote, Activity, Smartphone, Utensils, ShoppingBag, Settings, Menu, RefreshCw, X, TrendingUp, Hash, CreditCard, Star, History, User, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MenuEditor } from '../components/vendor/MenuEditor';
import { SHOPS } from '../data/foodCourtDB';
import { api, socket, formatRelativeTime } from '../api';
import { supabase } from '../supabaseClient';
import { getStoredUser, clearStoredUser } from '../utils/auth';
import './pages.css';
import './vendor.css';

const MOCK_TICKETS = [];

const COMPLETED_TICKETS_MOCK = [];

const getItemText = (item) => {
  if (!item) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    const qty = item.quantity || item.qty || 1;
    const name = item.name || item.title || item.itemName || 'Item';
    return `${qty}x ${name}`;
  }
  return String(item);
};

const formatOrderItems = (rawItems) => {
  if (!rawItems) return [];
  let parsed = rawItems;
  if (typeof rawItems === 'string') {
    try {
      const trimmed = rawItems.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        parsed = JSON.parse(trimmed);
      } else {
        return rawItems.split(', ').map(s => s.trim()).filter(Boolean);
      }
    } catch (e) {
      return rawItems.split(', ').map(s => s.trim()).filter(Boolean);
    }
  }
  if (Array.isArray(parsed)) {
    return parsed.map(getItemText).filter(Boolean);
  }
  if (typeof parsed === 'object') {
    return [getItemText(parsed)];
  }
  return [String(parsed)];
};

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
      const dbOrders = await api.getStallOrders(targetShopId);
      const localOrders = JSON.parse(localStorage.getItem(`sgu_vendor_orders_${targetShopId}`) || '[]');
      
      const allOrders = [...(dbOrders || [])];
      localOrders.forEach(localOrder => {
        if (!allOrders.find(o => o.id === localOrder.id)) {
          allOrders.push(localOrder);
        }
      });
      allOrders.sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0));
      
      const active = allOrders.filter(order => order.status !== 'completed' && order.status !== 'ready' && order.status !== 'cancelled').map(order => ({
        ...order,
        items: formatOrderItems(order.items)
      }));

      const done = allOrders.filter(order => order.status === 'completed' || order.status === 'ready' || order.status === 'cancelled').map(order => ({
        ...order,
        items: formatOrderItems(order.items)
      }));

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
          items: formatOrderItems(newOrder.items)
        };
        return [formatted, ...prev];
      });
    };

    const handleStatusUpdate = (updatedOrder) => {
      const targetId = updatedOrder?.id || updatedOrder?.orderId;
      const nextStatus = updatedOrder?.status;
      if (!targetId || !nextStatus) return;

      if (nextStatus === 'completed' || nextStatus === 'ready' || nextStatus === 'cancelled') {
        setTickets(prev => prev.filter(t => String(t.id) !== String(targetId)));
        setCompletedTickets(prev => {
          const formatted = {
            ...updatedOrder,
            id: targetId,
            status: nextStatus,
            items: formatOrderItems(updatedOrder.items)
          };
          if (prev.some(t => String(t.id) === String(targetId))) {
            return prev.map(t => String(t.id) === String(targetId) ? formatted : t);
          }
          return [formatted, ...prev];
        });
      } else {
        setTickets(prev => {
          if (prev.some(t => String(t.id) === String(targetId))) {
            return prev.map(t => String(t.id) === String(targetId) ? { 
              ...t, 
              status: nextStatus 
            } : t);
          }
          const formatted = {
            ...updatedOrder,
            id: targetId,
            status: nextStatus,
            items: formatOrderItems(updatedOrder.items)
          };
          return [formatted, ...prev];
        });
      }
    };

    socket.on('order_new', handleNewOrder);
    socket.on('order_status_update', handleStatusUpdate);

    // Setup Supabase Realtime Broadcast & Postgres Database Listener
    const channel = supabase.channel(`vendor_sync_${targetShopId}`)
      .on('broadcast', { event: 'order_new' }, (payload) => {
        const newOrd = payload?.order || payload?.payload?.order || payload;
        if (newOrd && newOrd.id) {
           handleNewOrder(newOrd);
           // Persist to local storage to survive refreshes
           const existing = JSON.parse(localStorage.getItem(`sgu_vendor_orders_${targetShopId}`) || '[]');
           if (!existing.find(o => o.id === newOrd.id)) {
             localStorage.setItem(`sgu_vendor_orders_${targetShopId}`, JSON.stringify([newOrd, ...existing]));
           }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          const newOrd = payload.new;
          const ordStallId = newOrd.stall_id || newOrd.stallId || newOrd.shop_id || newOrd.shopId;
          if (ordStallId && String(ordStallId) === String(targetShopId)) {
            handleNewOrder(newOrd);
            // Persist to local storage to survive refreshes
            const existing = JSON.parse(localStorage.getItem(`sgu_vendor_orders_${targetShopId}`) || '[]');
            if (!existing.find(o => o.id === newOrd.id)) {
              localStorage.setItem(`sgu_vendor_orders_${targetShopId}`, JSON.stringify([newOrd, ...existing]));
            }
          }
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const updatedOrd = payload.new;
          const ordStallId = updatedOrd.stall_id || updatedOrd.stallId || updatedOrd.shop_id || updatedOrd.shopId;
          if (ordStallId && String(ordStallId) === String(targetShopId)) {
            handleStatusUpdate(updatedOrd);
          }
        }
      })
      .subscribe();

    // Polling fallback (poll every 2 seconds for instant order updates)
    const intervalTime = 2000;
    const interval = setInterval(loadOrders, intervalTime);

    return () => {
      socket.off('order_new', handleNewOrder);
      socket.off('order_status_update', handleStatusUpdate);
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [targetShopId, loadOrders]);

  // Security Gate & Session Check
  useEffect(() => {
    const parsedUser = getStoredUser();
    if (!parsedUser || !parsedUser.role) {
      clearStoredUser();
      navigate('/login', { replace: true });
      return;
    }
    
    // Self-healing session check for corrupted owner sessions from previous bugs
    const isOwnerSessionCorrupted = parsedUser.role === 'owner' && 
      (!parsedUser.shopId || parsedUser.shopId === 'undefined' || parsedUser.shopId === 'null');
      
    if (isOwnerSessionCorrupted) {
      console.warn('Clearing corrupted owner session on VendorDashboard:', parsedUser);
      clearStoredUser();
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

    const currentStallId = cleanUrlShopId || userShopId;
    if (currentStallId) {
      // Initial stall status load
      api.getStalls()
        .then(stalls => {
          const stall = stalls.find(s => s.id === currentStallId);
          if (stall) {
            setShopStatus(stall.online === 1 || stall.online === true ? 'OPEN' : 'CLOSED');
            setIsBusyMode(stall.busyMode === 1 || stall.busyMode === true);
          }
        })
        .catch(console.error);

      // Listen to real-time stall updates
      const stallChannel = supabase
        .channel(`vendor-stall-${currentStallId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stalls', filter: `id=eq.${currentStallId}` }, (payload) => {
          const stall = payload.new;
          if (stall) {
            setShopStatus(stall.online === 1 || stall.online === true ? 'OPEN' : 'CLOSED');
            setIsBusyMode(stall.busyMode === 1 || stall.busyMode === true);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(stallChannel);
      };
    }
  }, [navigate, urlShopId, cleanUrlShopId]);

  // Today's Metrics Calculation
  const metrics = useMemo(() => {
    const today = new Date().toDateString();
    
    const getOrderDate = (t) => {
      if (t.timestamp) return new Date(t.timestamp);
      if (t.created_at) return new Date(t.created_at);
      if (t.id && t.id.toString().startsWith('ORD-')) {
        const timestampStr = t.id.toString().replace('ORD-', '');
        const num = parseInt(timestampStr, 10);
        if (!isNaN(num)) return new Date(num);
      }
      return new Date();
    };

    const todayCompleted = completedTickets.filter(t => getOrderDate(t).toDateString() === today);
    const todayPending = tickets.filter(t => getOrderDate(t).toDateString() === today);
    
    const totalOrders = todayCompleted.length + todayPending.length;
    
    const allTodayOrders = [...todayCompleted, ...todayPending];
    
    const totalRevenue = allTodayOrders.reduce((sum, t) => sum + t.total, 0);
    const cashRevenue = allTodayOrders.filter(t => t.payment === 'Cash').reduce((sum, t) => sum + t.total, 0);
    const upiRevenue = allTodayOrders.filter(t => t.payment === 'Online UPI').reduce((sum, t) => sum + t.total, 0);

    // Calculate Trending Item
    const itemCounts = {};
    [...todayCompleted, ...todayPending].forEach(t => {
      let itemsList = [];
      if (t.originalItems && Array.isArray(t.originalItems)) {
        itemsList = t.originalItems;
      } else if (typeof t.items === 'string') {
        itemsList = t.items.split(',').map(s => ({ name: s.trim(), quantity: 1 }));
      }
      
      itemsList.forEach(item => {
        if (item.name) {
          itemCounts[item.name] = (itemCounts[item.name] || 0) + (Number(item.quantity) || 1);
        }
      });
    });

    let trendingItem = 'No Orders';
    let maxCount = 0;
    for (const [name, count] of Object.entries(itemCounts)) {
      if (count > maxCount) {
        maxCount = count;
        trendingItem = name;
      }
    }

    return { totalOrders, totalRevenue, upiRevenue, trendingItem, trendingCount: maxCount };
  }, [tickets, completedTickets]);

  const handleToggleShop = async () => {
    const newStatus = shopStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    const isOnlineVal = newStatus === 'OPEN' ? 1 : 0;
    try {
      if (targetShopId) {
        await api.updateStallStatus(targetShopId, { online: isOnlineVal });
        socket.emit('stall_status_update', { id: targetShopId, online: isOnlineVal });
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
    
    // Optimistic UI Update
    setIsBusyMode(nextBusy);
    
    try {
      if (targetShopId) {
        await api.updateStallStatus(targetShopId, { busyMode: nextBusy, waitTime: nextWait });
        socket.emit('stall_status_update', { id: targetShopId, busyMode: nextBusy, waitTime: nextWait });
      }
    } catch (err) {
      // Revert on failure
      setIsBusyMode(!nextBusy);
      alert('Failed to toggle busy mode: ' + err.message);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await api.updateOrderStatus(id, newStatus);
      
      if (newStatus === 'completed' || newStatus === 'ready' || newStatus === 'cancelled') {
        setTickets(prev => prev.filter(t => String(t.id) !== String(id)));
        const ticket = tickets.find(t => String(t.id) === String(id));
        if (ticket) {
          setCompletedTickets(prev => {
            if (prev.some(t => String(t.id) === String(id))) {
              return prev.map(t => String(t.id) === String(id) ? { ...t, status: newStatus } : t);
            }
            return [{ ...ticket, status: newStatus, timestamp: new Date().toISOString() }, ...prev];
          });
        }
      } else {
        setTickets(prev => prev.map(t => String(t.id) === String(id) ? { ...t, status: newStatus } : t));
      }
    } catch (err) {
      alert('Failed to update order status: ' + err.message);
    }
  };

  const activeTickets = useMemo(() => {
    return tickets;
  }, [tickets]);

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
        
        <div className="kds-controls flex items-center gap-2 flex-wrap">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`elite-ctrl-btn ${isBusyMode ? 'busy' : 'active'}`} 
            onClick={handleToggleBusy}
          >
            <Clock size={16} /> <span>{isBusyMode ? 'BUSY' : 'NORMAL'}</span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="elite-ctrl-btn management" 
            onClick={() => { setActiveSidebarTab('menu'); setIsSidebarOpen(true); }}
          >
            <Settings size={16} /> <span>MENU</span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="elite-ctrl-btn management" 
            onClick={() => { setActiveSidebarTab('history'); setIsSidebarOpen(true); }}
          >
            <History size={16} /> <span>HISTORY</span>
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
            <LogOut size={16} /> <span>EXIT</span>
          </motion.button>
        </div>
      </header>

      <main className="kds-main relative">
        {/* Closed Watermark */}
        <div className={`closed-watermark ${shopStatus === 'CLOSED' ? 'visible' : ''}`}>
          <div className="watermark-text">SHOP CLOSED</div>
        </div>

        {/* Admin Command Dashboard */}
        <div className="command-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
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

          

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="elite-card command-card">
            <div className="flex justify-between items-start">
              <span className="command-label">UPI Collection</span>
              <Smartphone size={20} className="text-blue-500" />
            </div>
            <span className="command-value">₹{metrics.upiRevenue}</span>
            <span className="command-subvalue text-blue-600">Auto-Verified</span>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="elite-card command-card">
            <div className="flex justify-between items-start">
              <span className="command-label">Trending Item</span>
              <Flame size={20} className="text-orange-500" />
            </div>
            <span className="command-value" style={{ fontSize: '1.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {metrics.trendingItem}
            </span>
            <span className="command-subvalue text-orange-600">
              {metrics.trendingCount} {metrics.trendingCount === 1 ? 'Order' : 'Orders'} Today
            </span>
          </motion.div>
        </div>

        {/* Kitchen Queue */}
        <div className="flex flex-col mt-4 flex-1 min-h-0" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <h3 className="heading-3 text-white flex items-center gap-2 m-0 mb-4" style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <Utensils size={20} className="text-red-500" />
            Kitchen Queue ({activeTickets.length})
          </h3>
          <div className="kds-ticket-scroll" style={{ marginTop: 0, padding: '0 0 40px 0' }}>
              <AnimatePresence>
                {activeTickets.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center py-20 text-slate-400 font-bold text-lg w-full text-center"
                    style={{ border: '2px dashed rgba(255, 255, 255, 0.1)', borderRadius: '24px' }}
                  >
                    <CheckCircle size={48} className="text-slate-500 mb-2 opacity-50" />
                    Kitchen is Clear!
                  </motion.div>
                ) : (
                  activeTickets.map(ticket => (
                    <motion.div 
                      key={ticket.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8, x: 50 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -50 }}
                      className="elite-card kds-ticket"
                      style={{
                        borderColor: ticket.status === 'placed' ? '#F87171' : 
                                     ticket.status === 'preparing' ? '#FBBF24' : '#4ADE80'
                      }}
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
                        {Array.isArray(ticket.items) ? (
                          ticket.items.map((item, i) => (
                            <div key={i} className="ticket-item font-bold text-slate-700">{getItemText(item)}</div>
                          ))
                        ) : (
                          <div className="ticket-item font-bold text-slate-700">{getItemText(ticket.items)}</div>
                        )}
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
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {ticket.status === 'preparing' ? 'PREPARING' : 
                             ticket.status === 'ready' ? 'READY' :
                             'NEW ORDER'}
                          </span>
                        </div>

                        {(ticket.status === 'placed' || ticket.status === 'preparing') && (
                          <div className="flex gap-3 w-full">
                            <motion.button 
                              whileHover={{ scale: ticket.status === 'preparing' ? 1 : 1.03 }}
                              whileTap={{ scale: ticket.status === 'preparing' ? 1 : 0.97 }}
                              disabled={ticket.status === 'preparing'}
                              className={`flex-1 flex items-center justify-center gap-2 py-5 px-4 rounded-xl font-black text-[13px] uppercase tracking-wider cursor-pointer transition-all border border-solid ${
                                ticket.status === 'preparing' 
                                  ? 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed shadow-inner' 
                                  : 'vendor-btn-preparing bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                              }`}
                              onClick={() => handleUpdateStatus(ticket.id, 'preparing')}
                            >
                              <Clock size={16} className={ticket.status === 'preparing' ? 'text-slate-500' : 'text-current'} />
                              Preparing
                            </motion.button>

                            <motion.button 
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              className="vendor-btn-ready flex-1 flex items-center justify-center gap-2 py-5 px-4 rounded-xl font-black text-[13px] uppercase tracking-wider bg-green-50 text-green-600 border border-solid border-green-200 hover:bg-green-100 cursor-pointer transition-all"
                              onClick={() => handleUpdateStatus(ticket.id, 'ready')}
                            >
                              <CheckCircle size={16} className="text-current" />
                              Ready
                            </motion.button>
                          </div>
                        )}

                        {ticket.status === 'ready' && (
                          <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            className="jumbo-btn bg-green-500"
                            onClick={() => handleUpdateStatus(ticket.id, 'completed')}
                          >
                            <CheckCircle size={20} />
                            MARK COMPLETED
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
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
              <div className="flex justify-between items-center mb-8 mt-2">
                <h2 className="text-4xl font-bold uppercase" style={{ color: '#0f172a', fontFamily: 'Oswald, sans-serif', margin: 0, letterSpacing: '0.05em' }}>OPERATIONS</h2>
                <button className="p-3 hover:bg-slate-200 rounded-full transition-colors" style={{ color: '#0f172a', border: 'none', background: 'transparent', cursor: 'pointer' }} onClick={() => setIsSidebarOpen(false)}>
                  <X size={32} strokeWidth={2.5} />
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
                            {new Date(order.timestamp || order.created_at || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-1 mb-2">
                          {order.customer_name || order.customerName || 'Standard Order'}
                        </div>
                        
                        <p className="text-xs font-semibold text-slate-600 my-1">
                          {typeof order.items === 'string' 
                            ? order.items 
                            : Array.isArray(order.items) 
                              ? order.items.map(i => typeof i === 'string' ? i : (i ? `${i.quantity || 1}x ${i.name || 'Item'}` : '')).filter(Boolean).join(', ') 
                              : ''}
                        </p>

                        <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-100 mt-1">
                          <span className="font-bold text-navy-900">₹{order.total}</span>
                          <div className="flex gap-2 items-center">
                            <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-600 px-2 py-1 rounded">
                              {order.payment}
                            </span>
                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${
                              order.status === 'ready' ? 'bg-green-100 text-green-700 font-bold' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {order.status === 'ready' ? '✅ READY FOR PICKUP' : order.status}
                            </span>
                            {order.status === 'ready' && (
                              <button 
                                onClick={() => handleUpdateStatus(order.id, 'completed')}
                                className="text-[9px] font-black uppercase bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition-colors cursor-pointer border-none"
                              >
                                Mark Completed
                              </button>
                            )}
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
