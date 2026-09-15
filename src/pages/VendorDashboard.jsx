import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Clock, Volume2, Power, LogOut, CheckCircle, Banknote, Activity, Smartphone, Utensils, ShoppingBag, Settings, Menu, RefreshCw, X, TrendingUp, Hash, CreditCard, Star, History, User, Flame } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { MenuEditor } from '../components/vendor/MenuEditor';
import { SHOPS } from '../data/foodCourtDB';
import { api, socket, formatRelativeTime } from '../api';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';
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
  const prefersReducedMotion = useReducedMotion();
  const [tickets, setTickets] = useState([]);
  const [completedTickets, setCompletedTickets] = useState([]);
  const [isPowerSaver, setIsPowerSaver] = useState(false);
  const [isBusyMode, setIsBusyMode] = useState(false);
  const [heartbeat, setHeartbeat] = useState(true);
  const [shopStatus, setShopStatus] = useState('CLOSED'); // OPEN | CLOSED
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
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
      
      const orderMap = new Map();
      (dbOrders || []).forEach(o => {
        if (o && o.id) orderMap.set(String(o.id), o);
      });
      (localOrders || []).forEach(o => {
        if (o && o.id && !orderMap.has(String(o.id))) {
          orderMap.set(String(o.id), o);
        }
      });

      const allOrders = Array.from(orderMap.values());
      allOrders.sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0));
      
      const active = allOrders.filter(order => order.status !== 'completed' && order.status !== 'ready' && order.status !== 'cancelled').map(order => ({
        ...order,
        customerName: order.customerName || order.customer_name || 'Student',
        payment: order.payment || order.payment_method || 'Online UPI',
        type: order.type || order.order_type || 'Dine-In',
        items: formatOrderItems(order.items)
      }));

      const done = allOrders.filter(order => order.status === 'completed' || order.status === 'ready' || order.status === 'cancelled').map(order => ({
        ...order,
        customerName: order.customerName || order.customer_name || 'Student',
        payment: order.payment || order.payment_method || 'Online UPI',
        type: order.type || order.order_type || 'Dine-In',
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

    const handleNewOrder = async (newOrder) => {
      if (!newOrder || !newOrder.id) return;
      let fullOrder = newOrder;
      if (!fullOrder.items || (Array.isArray(fullOrder.items) && fullOrder.items.length === 0)) {
        try {
          const fetched = await api.getOrder(newOrder.id);
          if (fetched) fullOrder = fetched;
        } catch (_e) {}
      }

      const formatted = {
        ...fullOrder,
        customerName: fullOrder.customerName || fullOrder.customer_name || 'Student',
        payment: fullOrder.payment || fullOrder.payment_method || 'Online UPI',
        total: Number(fullOrder.total) || 0,
        type: fullOrder.type || fullOrder.order_type || 'Dine-In',
        items: formatOrderItems(fullOrder.items)
      };

      setTickets(prev => {
        if (prev.some(t => String(t.id) === String(formatted.id))) return prev;
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
            customerName: updatedOrder.customerName || updatedOrder.customer_name || 'Student',
            payment: updatedOrder.payment || updatedOrder.payment_method || 'Online UPI',
            type: updatedOrder.type || updatedOrder.order_type || 'Dine-In',
            items: formatOrderItems(updatedOrder.items)
          };
          if (prev.some(t => String(t.id) === String(targetId))) {
            return prev.map(t => String(t.id) === String(targetId) ? { ...t, ...formatted, status: nextStatus } : t);
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
            customerName: updatedOrder.customerName || updatedOrder.customer_name || 'Student',
            payment: updatedOrder.payment || updatedOrder.payment_method || 'Online UPI',
            type: updatedOrder.type || updatedOrder.order_type || 'Dine-In',
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
           if (!existing.find(o => String(o.id) === String(newOrd.id))) {
             localStorage.setItem(`sgu_vendor_orders_${targetShopId}`, JSON.stringify([newOrd, ...existing]));
           }
        }
      })
      .on('broadcast', { event: 'order_status_update' }, (payload) => {
        const data = payload?.payload || payload;
        if (data && (data.id || data.orderId)) {
          handleStatusUpdate(data);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          const newOrd = payload.new;
          const ordStallId = newOrd.stall_id || newOrd.stallId || newOrd.shop_id || newOrd.shopId;
          if (ordStallId && String(ordStallId).toLowerCase().trim() === String(targetShopId).toLowerCase().trim()) {
            handleNewOrder(newOrd);
            // Persist to local storage to survive refreshes
            const existing = JSON.parse(localStorage.getItem(`sgu_vendor_orders_${targetShopId}`) || '[]');
            if (!existing.find(o => String(o.id) === String(newOrd.id))) {
              localStorage.setItem(`sgu_vendor_orders_${targetShopId}`, JSON.stringify([newOrd, ...existing]));
            }
          }
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          const updatedOrd = payload.new;
          const ordStallId = updatedOrd.stall_id || updatedOrd.stallId || updatedOrd.shop_id || updatedOrd.shopId;
          if (!ordStallId || String(ordStallId).toLowerCase().trim() === String(targetShopId).toLowerCase().trim()) {
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
    const isOwnerSessionCorrupted = parsedUser.role === 'vendor' && 
      (!parsedUser.shopId || parsedUser.shopId === 'undefined' || parsedUser.shopId === 'null');
      
    if (isOwnerSessionCorrupted) {
      console.warn('Clearing corrupted owner session on VendorDashboard:', parsedUser);
      clearStoredUser();
      navigate('/login', { replace: true });
      return;
    }

    if (parsedUser.role !== 'vendor' && parsedUser.role !== 'admin') {
      navigate('/student');
      return;
    }

    const userShopId = parsedUser.shopId || parsedUser.shopid;

    // If owner tries to access without a shopId in URL, redirect to their own shop
    if (parsedUser.role === 'vendor' && !cleanUrlShopId && userShopId) {
      navigate(`/vendor/${userShopId}`, { replace: true });
      return;
    }

    // Security: owners can only access their own shop's dashboard
    if (parsedUser.role === 'vendor' && cleanUrlShopId && userShopId && cleanUrlShopId !== userShopId) {
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
            setShopStatus(stall.is_online === 1 || stall.is_online === true ? 'OPEN' : 'CLOSED');
            setIsBusyMode(stall.busy_mode === 1 || stall.busy_mode === true);
          }
        })
        .on('broadcast', { event: 'stall_status_changed' }, (payload) => {
          const data = payload?.payload;
          if (data && (String(data.id) === String(currentStallId) || String(data.stallId) === String(currentStallId))) {
            const isOpen = data.online === 1 || data.online === true || data.status === 'ONLINE' || data.is_online === true;
            setShopStatus(isOpen ? 'OPEN' : 'CLOSED');
          }
        })
        .subscribe();

      const handleLocalStallUpdate = (e) => {
        const data = e?.detail;
        if (data && (String(data.id) === String(currentStallId) || String(data.stallId) === String(currentStallId))) {
          const isOpen = data.online === 1 || data.online === true || data.status === 'ONLINE' || data.is_online === true;
          setShopStatus(isOpen ? 'OPEN' : 'CLOSED');
        }
      };

      window.addEventListener('sgu:stall_status_updated', handleLocalStallUpdate);

      return () => {
        supabase.removeChannel(stallChannel);
        window.removeEventListener('sgu:stall_status_updated', handleLocalStallUpdate);
      };
    }
  }, [navigate, urlShopId, cleanUrlShopId]);

  // Today's Metrics Calculation
  const metrics = useMemo(() => {
    const today = new Date().toDateString();
    
    const getOrderDate = (t) => {
      if (!t) return new Date();
      const val = t.timestamp || t.created_at || t.createdAt;
      if (val) {
        if (typeof val === 'number') return new Date(val);
        if (typeof val === 'string') {
          const num = Number(val);
          if (!isNaN(num) && num > 1000000000) return new Date(num);
          const d = new Date(val);
          if (!isNaN(d.getTime())) return d;
        }
      }
      if (t.id && String(t.id).startsWith('ORD-')) {
        const timestampStr = String(t.id).replace('ORD-', '');
        const num = parseInt(timestampStr, 10);
        if (!isNaN(num) && num > 1000000000) return new Date(num);
      }
      return new Date();
    };

    const isToday = (t) => {
      const d = getOrderDate(t);
      if (!d || isNaN(d.getTime())) return true;
      return d.toDateString() === today;
    };

    const todayCompleted = (completedTickets || []).filter(isToday);
    const todayPending = (tickets || []).filter(isToday);
    
    const allTodayOrders = [...todayPending, ...todayCompleted];
    const effectiveOrders = allTodayOrders.length > 0 ? allTodayOrders : [...(tickets || []), ...(completedTickets || [])];

    const totalOrders = effectiveOrders.length;
    
    const totalRevenue = effectiveOrders.reduce((sum, t) => sum + (Number(t.total || t.total_amount || t.amount) || 0), 0);
    const cashRevenue = effectiveOrders
      .filter(t => (t.payment || t.payment_method) === 'Cash')
      .reduce((sum, t) => sum + (Number(t.total || t.total_amount || t.amount) || 0), 0);
    const upiRevenue = effectiveOrders
      .filter(t => {
        const p = String(t.payment || t.payment_method || '').toLowerCase();
        return p.includes('upi') || p.includes('online');
      })
      .reduce((sum, t) => sum + (Number(t.total || t.total_amount || t.amount) || 0), 0);

    // Calculate Trending Item
    const itemCounts = {};
    effectiveOrders.forEach(t => {
      let itemsList = [];
      if (t.originalItems && Array.isArray(t.originalItems)) {
        itemsList = t.originalItems;
      } else if (Array.isArray(t.items)) {
        itemsList = t.items.map(str => {
          const match = String(str).match(/^(\d+)x\s+(.+)$/i);
          if (match) return { name: match[2].trim(), quantity: parseInt(match[1], 10) || 1 };
          return { name: String(str).trim(), quantity: 1 };
        });
      } else if (typeof t.items === 'string') {
        itemsList = t.items.split(',').map(s => {
          const match = s.trim().match(/^(\d+)x\s+(.+)$/i);
          if (match) return { name: match[2].trim(), quantity: parseInt(match[1], 10) || 1 };
          return { name: s.trim(), quantity: 1 };
        });
      }
      
      itemsList.forEach(item => {
        const name = item.name || item.itemName || item.title;
        if (name && name !== 'undefined' && name !== 'null') {
          itemCounts[name] = (itemCounts[name] || 0) + (Number(item.quantity || item.qty) || 1);
        }
      });
    });

    let trendingItem = totalOrders > 0 ? 'Food Order' : 'No Orders';
    let maxCount = 0;
    for (const [name, count] of Object.entries(itemCounts)) {
      if (count > maxCount) {
        maxCount = count;
        trendingItem = name;
      }
    }

    return { totalOrders, totalRevenue, upiRevenue, cashRevenue, trendingItem, trendingCount: maxCount };
  }, [tickets, completedTickets]);

  const handleToggleShop = async () => {
    const prevStatus = shopStatus;
    const newStatus = shopStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    const isOnlineVal = newStatus === 'OPEN' ? 1 : 0;
    
    setShopStatus(newStatus);
    
    try {
      if (targetShopId) {
        const payload = {
          id: targetShopId,
          stallId: targetShopId,
          online: isOnlineVal,
          status: newStatus === 'OPEN' ? 'ONLINE' : 'OFFLINE'
        };
        const res = await api.updateStallStatus(targetShopId, payload);
        if (res && res.success === false) {
          console.warn('Stall status notice:', res.message);
        }
        socket.emit('stall_status_update', payload);
      }
      showToast(`Stall is now ${newStatus === 'OPEN' ? 'ONLINE 🟢' : 'OFFLINE 🔴'}`, newStatus === 'OPEN' ? 'success' : 'info');
      if (newStatus === 'OPEN') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      } else {
        setShowConfetti(false);
      }
    } catch (err) {
      console.error('handleToggleShop catch:', err);
      showToast(`Stall is now ${newStatus === 'OPEN' ? 'ONLINE 🟢' : 'OFFLINE 🔴'}`, 'info');
    }
  };

  const handleToggleBusyMode = async () => {
    const nextBusy = !isBusyMode;
    const nextWait = nextBusy ? 25 : 10;
    setIsBusyMode(nextBusy);
    setWaitTime(nextWait);

    try {
      if (targetShopId) {
        await api.updateStallStatus(targetShopId, { busyMode: nextBusy, waitTime: nextWait });
        socket.emit('stall_status_update', { id: targetShopId, busyMode: nextBusy, waitTime: nextWait });
      }
      showToast(`Busy Mode ${nextBusy ? 'ACTIVATED (25 min wait)' : 'DEACTIVATED'} 🔥`, 'info');
    } catch (err) {
      // Revert on failure
      setIsBusyMode(!nextBusy);
      showToast('Failed to toggle busy mode: ' + err.message, 'error');
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    const vendorUser = getStoredUser();
    const vendorEmail = vendorUser?.username || vendorUser?.email || 'vendor@sgu.edu';
    
    // Update local state immediately for instant feedback
    if (newStatus === 'completed' || newStatus === 'ready' || newStatus === 'cancelled') {
      const ticket = tickets.find(t => String(t.id) === String(id)) || completedTickets.find(t => String(t.id) === String(id));
      setTickets(prev => prev.filter(t => String(t.id) !== String(id)));
      if (ticket) {
        setCompletedTickets(prev => {
          const updatedItem = { ...ticket, status: newStatus, timestamp: new Date().toISOString() };
          if (prev.some(t => String(t.id) === String(id))) {
            return prev.map(t => String(t.id) === String(id) ? updatedItem : t);
          }
          return [updatedItem, ...prev];
        });
      }
    } else {
      setTickets(prev => prev.map(t => String(t.id) === String(id) ? { ...t, status: newStatus } : t));
    }

    // Persist updated status to vendor local storage immediately
    if (targetShopId) {
      try {
        const existing = JSON.parse(localStorage.getItem(`sgu_vendor_orders_${targetShopId}`) || '[]');
        const updatedLocal = existing.map(o => String(o.id) === String(id) ? { ...o, status: newStatus } : o);
        localStorage.setItem(`sgu_vendor_orders_${targetShopId}`, JSON.stringify(updatedLocal));
      } catch (_e) {}
    }

    try {
      await api.updateOrderStatus(id, newStatus, vendorEmail);
      showToast(`Order #${id} updated to ${newStatus.toUpperCase()} ⚡`, 'success');
    } catch (err) {
      showToast('Failed to update order status: ' + err.message, 'error');
    }
  };

  const activeTickets = useMemo(() => {
    return tickets;
  }, [tickets]);

  return (
    <div className={`vendor-kds-container page-transition ${isPowerSaver ? 'power-saver' : ''}`} style={{ flexDirection: 'row', height: '100vh', overflow: 'hidden' }}>
      
      {/* SIDEBAR — hover-to-expand on desktop */}
      <aside className="vendor-sidebar hidden md:flex">
        {/* Logo */}
        <div className="vs-logo">
          <Utensils size={22} className="text-white" />
        </div>

        {/* Nav items */}
        <nav className="vs-nav">
          <button
            className={`vs-item ${!isBusyMode ? 'vs-active' : ''}`}
            onClick={handleToggleBusyMode}
          >
            <span className="vs-icon">
              <Clock size={22} color={isBusyMode ? '#F59E0B' : '#4ADE80'} />
            </span>
            <span className="vs-label" style={{ color: isBusyMode ? '#F59E0B' : '#4ADE80' }}>
              {isBusyMode ? 'BUSY' : 'NORMAL'}
            </span>
          </button>

          <button
            className="vs-item"
            onClick={() => { setActiveSidebarTab('menu'); setIsSidebarOpen(true); }}
          >
            <span className="vs-icon"><Settings size={22} /></span>
            <span className="vs-label">MENU</span>
          </button>

          <button
            className="vs-item"
            onClick={() => { setActiveSidebarTab('history'); setIsSidebarOpen(true); }}
          >
            <span className="vs-icon"><History size={22} /></span>
            <span className="vs-label">HISTORY</span>
          </button>
        </nav>

        {/* Logout pinned to bottom */}
        <div className="vs-bottom">
          <button
            className="vs-item vs-item-logout"
            style={{ color: '#DC2626' }}
            onClick={async () => {
              clearStoredUser();
              try { await supabase.auth.signOut(); } catch (_e) {}
              navigate('/login', { replace: true });
            }}
          >
            <span className="vs-icon" style={{ color: '#DC2626' }}><LogOut size={22} color="#DC2626" /></span>
            <span className="vs-label" style={{ color: '#DC2626' }}>LOGOUT</span>
          </button>
        </div>
      </aside>

      {/* MOBILE POPUP SIDEBAR DRAWER (Only opens on mobile when 3-line option is clicked) */}
      <AnimatePresence>
        {isMobileNavOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[300] md:hidden" 
              onClick={() => setIsMobileNavOpen(false)} 
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 h-[100dvh] max-h-screen w-[310px] max-w-[85vw] bg-white z-[310] md:hidden shadow-2xl p-5 sm:p-6 flex flex-col justify-between border-r border-slate-200/80 font-sans overflow-hidden"
            >
              {/* Header with Logo & Close button */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#DC2626] text-white flex items-center justify-center shadow-md shadow-red-500/20 shrink-0">
                    <Utensils size={22} strokeWidth={2.5} />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <h2 className="text-base font-black text-slate-900 uppercase tracking-wide m-0 leading-tight" style={{ fontFamily: 'Oswald, sans-serif' }}>
                      {currentShop?.name || 'Vendor Operations'}
                    </h2>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block leading-tight">Navigation Menu</span>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={() => setIsMobileNavOpen(false)}
                  className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl border-0 bg-transparent cursor-pointer transition-colors"
                >
                  <X size={22} strokeWidth={2.5} />
                </button>
              </div>

              {/* Menu Options - Scrollable Middle Area with Generous Mobile Spacing */}
              <div className="flex-1 overflow-y-auto py-4 my-2 pr-1 flex flex-col gap-5" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px', marginBottom: '16px' }}>
                <button
                  type="button"
                  className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer text-left shadow-2xs ${
                    isBusyMode 
                      ? 'bg-amber-50/90 border-amber-200/90 text-amber-950 hover:bg-amber-100/90' 
                      : 'bg-emerald-50/90 border-emerald-200/90 text-emerald-950 hover:bg-emerald-100/90'
                  }`}
                  style={{ marginTop: '14px', marginBottom: '18px' }}
                  onClick={() => { handleToggleBusyMode(); setIsMobileNavOpen(false); }}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isBusyMode ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    <Clock size={22} strokeWidth={2.2} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-black text-sm uppercase tracking-wide text-slate-900" style={{ fontFamily: 'Oswald, sans-serif' }}>
                      MODE: {isBusyMode ? 'BUSY' : 'NORMAL'}
                    </span>
                    <span className="text-xs font-bold text-slate-500 leading-tight">
                      {isBusyMode ? '25 min wait time' : 'Standard speed'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 hover:bg-slate-100/90 text-left cursor-pointer transition-all shadow-2xs group"
                  style={{ marginTop: '14px', marginBottom: '18px' }}
                  onClick={() => { setActiveSidebarTab('menu'); setIsSidebarOpen(true); setIsMobileNavOpen(false); }}
                >
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100/80 text-indigo-600 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                    <Settings size={22} strokeWidth={2.2} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-black text-sm uppercase tracking-wide text-slate-900" style={{ fontFamily: 'Oswald, sans-serif' }}>
                      CATALOG EDITOR
                    </span>
                    <span className="text-xs font-bold text-slate-500 leading-tight">
                      Manage items & pricing
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 hover:bg-slate-100/90 text-left cursor-pointer transition-all shadow-2xs group"
                  style={{ marginTop: '14px', marginBottom: '18px' }}
                  onClick={() => { setActiveSidebarTab('history'); setIsSidebarOpen(true); setIsMobileNavOpen(false); }}
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100/80 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                    <History size={22} strokeWidth={2.2} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-black text-sm uppercase tracking-wide text-slate-900" style={{ fontFamily: 'Oswald, sans-serif' }}>
                      ORDER HISTORY
                    </span>
                    <span className="text-xs font-bold text-slate-500 leading-tight">
                      Completed receipts & stats
                    </span>
                  </div>
                </button>
              </div>

              {/* Logout Button - Shrunk in size & shifted upwards for mobile viewports */}
              <div className="pt-4 border-t border-slate-200/90 mt-auto shrink-0 pb-8 sm:pb-10 bg-white flex justify-center">
                <button
                  type="button"
                  className="w-[85%] max-w-[240px] h-10 flex items-center justify-center gap-2 rounded-xl bg-[#DC2626] hover:bg-red-700 active:bg-red-800 text-white cursor-pointer font-extrabold text-xs tracking-wider uppercase transition-all shadow-md shadow-red-500/20 active:scale-[0.98] border border-red-600 my-2"
                  style={{ backgroundColor: '#DC2626', color: '#FFFFFF', fontFamily: 'Oswald, sans-serif', height: '40px', marginTop: '8px', marginBottom: '16px' }}
                  onClick={async () => {
                    setIsMobileNavOpen(false);
                    clearStoredUser();
                    try { await supabase.auth.signOut(); } catch (_e) {}
                    navigate('/login', { replace: true });
                  }}
                >
                  <LogOut size={17} strokeWidth={2.5} className="text-white" />
                  <span className="font-extrabold text-xs uppercase tracking-wider text-white">LOGOUT</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MAIN CONTENT WRAPPER */}
      <div className="vendor-main-content flex-1 flex flex-col min-w-0 h-full relative" style={{ overflowY: 'auto' }}>
        
        <header className={`kds-header shadow-lg ${shopStatus === 'CLOSED' ? 'closed' : ''}`} style={{ flexShrink: 0 }}>
          <div className="kds-header-left flex items-center gap-4 sm:gap-8 w-full justify-between">
            <div className="flex items-center gap-3">
              {/* 3-Line Hamburger Option Button for Mobile Interface */}
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(true)}
                className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 hover:bg-white/30 text-white border border-white/20 cursor-pointer transition-all shrink-0 active:scale-95 shadow-xs"
                aria-label="Open Navigation Menu"
              >
                <Menu size={22} strokeWidth={2.5} />
              </button>

              <div className="flex flex-col">
                <h1 className="heading-2 text-white text-xl sm:text-2xl md:text-3xl" style={{ margin: 0 }}>{currentShop?.name || 'Vendor Dashboard'}</h1>
                <div className="heartbeat-monitor mt-0.5 sm:mt-1" style={{ padding: '3px 10px' }}>
                  <Activity size={13} color={heartbeat ? '#22C55E' : '#94A3B8'} className={heartbeat ? 'pulse' : ''} />
                  <span className="text-white opacity-80 text-[9px] sm:text-[10px] uppercase font-black tracking-widest">Live Operations</span>
                  {user && <span className="text-white opacity-60 text-[9px] sm:text-[10px] font-semibold ml-1.5 sm:ml-2">· {user.name}</span>}
                </div>
              </div>
            </div>

            {/* Premium Status Toggle & Food Pop Animation */}
            <div className="status-toggle-container relative">
              <div 
                className={`premium-switch ${shopStatus === 'CLOSED' ? 'closed' : ''}`}
                onClick={handleToggleShop}
              >
                <span className={`switch-text switch-text-open ${shopStatus === 'OPEN' ? 'active' : ''}`}>OPEN</span>
                <span className={`switch-text switch-text-closed ${shopStatus === 'CLOSED' ? 'active' : ''}`}>CLOSED</span>
                  <div 
                    className="switch-knob"
                    style={{ transform: shopStatus === 'CLOSED' ? 'translateX(58px)' : 'translateX(0)' }}
                  />
              </div>

              {/* Food Pop Animation Layer */}
              <AnimatePresence>
                {showConfetti && !prefersReducedMotion && (
                  <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center">
                    {[
                      { emoji: '🍕', x: 70, y: -35, rotate: 15 },
                      { emoji: '🍔', x: 85, y: 0, rotate: -10 },
                      { emoji: '🍟', x: -70, y: -35, rotate: -20 },
                      { emoji: '🥤', x: 70, y: 35, rotate: 10 },
                      { emoji: '🍩', x: -85, y: 0, rotate: 20 },
                      { emoji: '🌮', x: -70, y: 35, rotate: -15 },
                    ].map((item, i) => (
                      <motion.span
                        key={i}
                        aria-hidden="true"
                        initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                        animate={{ 
                          scale: [0, 1.15, 1, 0.9],
                          opacity: [0, 1, 1, 0],
                          x: [0, item.x * 0.8, item.x, item.x * 1.1],
                          y: [0, item.y * 0.8, item.y, item.y * 1.1 - 10],
                          rotate: [0, item.rotate, item.rotate * 1.5]
                        }}
                        transition={{ 
                          duration: 0.9, 
                          ease: [0.22, 1, 0.36, 1],
                          times: [0, 0.4, 0.7, 1],
                          delay: i * 0.06
                        }}
                        className="text-xl absolute drop-shadow-md"
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
                      >
                        {item.emoji}
                      </motion.span>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="kds-main relative flex-1 overflow-y-auto" style={{ padding: '16px' }}>
          {/* Closed Watermark */}
          <div className={`closed-watermark ${shopStatus === 'CLOSED' ? 'visible' : ''}`}>
            <div className="watermark-text">SHOP CLOSED</div>
          </div>

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
          <h3 className="heading-3 text-slate-800 flex items-center gap-2 m-0 mb-4" style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <Utensils size={20} className="text-red-500" />
            Kitchen Queue ({activeTickets.length})
          </h3>
          <div className="kds-ticket-scroll">
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
                      className="elite-card kds-ticket overflow-auto h-auto flex flex-col justify-between"
                      style={{
                        borderColor: ticket.status === 'placed' ? '#F87171' : 
                                     ticket.status === 'preparing' ? '#FBBF24' : '#4ADE80'
                      }}
                    >
                      <div className="ticket-header">
                        <div className="flex flex-col">
                          <span className="ticket-id text-2xl font-black">{ticket.id}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <User size={13} className="text-indigo-600 inline-block" />
                            <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                              {ticket.customerName || ticket.customer_name || ticket.customerEmail || 'Student'}
                            </span>
                          </div>
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

                      {/* Ordered Items Box - Dynamic from Supabase */}
                      <div className="ticket-items my-3 p-3 bg-slate-50/90 rounded-2xl border border-slate-200/80 flex flex-col gap-2">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-200/60">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                            Ordered Items ({Array.isArray(ticket.items) ? ticket.items.length : (ticket.items ? 1 : 0)})
                          </span>
                          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Qty & Price</span>
                        </div>
                        {Array.isArray(ticket.items) && ticket.items.length > 0 ? (
                          ticket.items.map((item, i) => {
                            let qty = typeof item === 'object' && item !== null ? (item.quantity || item.qty || 1) : 1;
                            let name = typeof item === 'object' && item !== null ? (item.name || item.title || 'Food Item') : String(item);
                            const price = typeof item === 'object' && item !== null ? Number(item.price || item.unit_price || 0) : 0;
                            
                            const match = name.match(/^(\d+)x\s*(.*)$/i);
                            if (match) {
                              qty = parseInt(match[1], 10) || qty;
                              name = match[2].trim();
                            }
                            return (
                              <div key={i} className="flex items-center justify-between gap-2 text-xs sm:text-sm font-extrabold text-slate-800">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-5 h-5 rounded-md bg-[#FF2E37] text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-2xs">
                                    {qty}x
                                  </span>
                                  <span className="truncate text-slate-900 font-extrabold">{name}</span>
                                </div>
                                {price > 0 ? (
                                  <span className="text-slate-600 font-bold text-xs shrink-0">₹{price * qty}</span>
                                ) : (
                                  <span className="text-slate-400 font-medium text-[11px] shrink-0">Incl.</span>
                                )}
                              </div>
                            );
                          })
                        ) : ticket.items ? (() => {
                          const rawText = getItemText(ticket.items);
                          const match = rawText.match(/^(\d+)x\s*(.*)$/i);
                          const qty = match ? parseInt(match[1], 10) : 1;
                          const name = match ? match[2].trim() : rawText;
                          return (
                            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-extrabold text-slate-800">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-md bg-[#FF2E37] text-white text-[11px] font-black flex items-center justify-center shrink-0 shadow-2xs">
                                  {qty}x
                                </span>
                                <span className="truncate text-slate-900 font-extrabold">{name}</span>
                              </div>
                            </div>
                          );
                        })() : (
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 italic">
                            <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-600 text-[11px] font-black flex items-center justify-center shrink-0">1x</span>
                            <span>Student Food Order</span>
                          </div>
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
                            ticket.status === 'pending_cash' ? 'bg-orange-100 text-orange-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {ticket.status === 'preparing' ? 'PREPARING' : 
                             ticket.status === 'ready' ? 'READY' :
                             ticket.status === 'pending_cash' ? 'AWAITING CASH' :
                             'NEW ORDER'}
                          </span>
                        </div>

                        {(!['ready', 'completed', 'cancelled'].includes(ticket.status)) && (
                          <div className="grid grid-cols-2 gap-2.5 w-full mt-3 min-w-0" data-ticket-id={ticket.id}>
                            <button 
                              disabled={ticket.status === 'preparing'}
                              className={`flex items-center justify-center gap-1.5 rounded-full font-extrabold text-xs sm:text-sm uppercase tracking-wider transition-all border-0 shadow-md min-w-0 ${
                                ticket.status === 'preparing' 
                                  ? 'cursor-default opacity-95' 
                                  : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                              }`}
                              style={{
                                height: '46px',
                                padding: '8px 10px',
                                borderRadius: '999px',
                                backgroundColor: ticket.status === 'preparing' ? '#94A3B8' : '#EF4444',
                                color: '#FFFFFF',
                                boxShadow: ticket.status === 'preparing' ? 'none' : '0 4px 12px rgba(239, 68, 68, 0.4)'
                              }}
                              onClick={() => handleUpdateStatus(ticket.id, 'preparing')}
                            >
                              <Clock size={16} className="text-white shrink-0" />
                              <span className="truncate">PREPARING</span>
                            </button>

                            <button 
                              className="flex items-center justify-center gap-1.5 rounded-full font-extrabold text-xs sm:text-sm uppercase tracking-wider cursor-pointer transition-all border-0 shadow-md hover:scale-[1.02] active:scale-[0.98] min-w-0"
                              style={{
                                height: '46px',
                                padding: '8px 10px',
                                borderRadius: '999px',
                                backgroundColor: '#22C55E',
                                color: '#FFFFFF',
                                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)'
                              }}
                              onClick={() => handleUpdateStatus(ticket.id, 'ready')}
                            >
                              <CheckCircle size={16} className="text-white shrink-0" />
                              <span className="truncate">READY</span>
                            </button>
                          </div>
                        )}

                        {ticket.status === 'ready' && (
                          <button 
                            className="jumbo-btn bg-green-500 hover:scale-[1.02] active:scale-[0.98]"
                            onClick={() => handleUpdateStatus(ticket.id, 'completed')}
                          >
                            <CheckCircle size={20} />
                            MARK COMPLETED
                          </button>
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
              <div className="flex items-center justify-between pb-3.5 sm:pb-4 mb-4 sm:mb-5 border-b border-slate-200/80 shrink-0 gap-3">
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-xl sm:text-2xl font-black uppercase text-slate-900 leading-tight m-0" style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: '0.04em' }}>
                    {activeSidebarTab === 'menu' ? 'CATALOG EDITOR' : 'ORDER HISTORY'}
                  </h2>
                  <span className="text-[11px] sm:text-xs font-extrabold text-slate-500 uppercase tracking-widest block leading-tight">
                    {activeSidebarTab === 'menu' ? 'Manage Menu & Pricing' : 'Completed Receipts'}
                  </span>
                </div>
                <button 
                  className="p-2 sm:p-2.5 hover:bg-slate-100 rounded-full transition-all text-slate-600 hover:text-slate-900 border-0 bg-transparent cursor-pointer flex items-center justify-center shrink-0" 
                  onClick={() => setIsSidebarOpen(false)}
                  title="Close Sidebar"
                >
                  <X size={22} strokeWidth={2.5} />
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
                        <div className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 mt-1 mb-2">
                          <User size={13} className="text-indigo-600 inline-block" />
                          <span>{order.customer_name || order.customerName || order.customer_email || 'Student'}</span>
                        </div>
                        
                        <p className="text-xs font-semibold text-slate-600 my-1">
                          {typeof order.items === 'string' 
                            ? order.items 
                            : Array.isArray(order.items) 
                              ? order.items.map(i => typeof i === 'string' ? i : (i ? `${i.quantity || 1}x ${i.name || 'Item'}` : '')).filter(Boolean).join(', ') 
                              : ''}
                        </p>

                        <div className="flex justify-between items-center pt-2.5 border-t border-dashed border-slate-200 mt-2">
                          <span className="font-extrabold text-navy-900 text-sm">₹{order.total}</span>
                          <div className="flex gap-2 items-center justify-end ml-auto">
                            <span className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg">
                              {order.payment}
                            </span>
                            <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                              order.status === 'ready' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-bold' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {order.status === 'ready' ? '✅ READY FOR PICKUP' : order.status}
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
    </div>
  );
};

export default VendorDashboard;
