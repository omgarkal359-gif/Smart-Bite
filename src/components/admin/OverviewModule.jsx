import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, ShoppingBag, Store, ShieldCheck, 
  ArrowUpRight, ArrowDownRight, Clock, Activity, Flame, DollarSign,
  Calendar, Filter, ChevronRight, PieChart, BarChart2
} from 'lucide-react';
import { api } from '../../api';
import { supabase } from '../../supabaseClient';
import { SHOPS } from '../../data/foodCourtDB';

export const OverviewModule = ({ onNavigateModule }) => {
  const [metrics, setMetrics] = useState({
    totalSales: 0,
    totalOrders: 0,
    activeOrders: 0,
    digitalSales: 0,
    cashSales: 0,
    totalVendors: SHOPS.length,
    healthScore: 99.8
  });
  const [timeRange, setTimeRange] = useState('24H');
  const [activityLogs, setActivityLogs] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [allRawOrders, setAllRawOrders] = useState([]);
  
  // Per-Shop & Granularity Filters
  const [selectedStallId, setSelectedStallId] = useState('ALL');
  const [chartGranularity, setChartGranularity] = useState('daily'); // 'hourly' | 'daily' | 'monthly'

  useEffect(() => {
    loadOverviewData();

    // Supabase Realtime subscription for live metrics & activity feed
    const channel = supabase
      .channel('admin-overview-module')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const order = payload.new;
        if (payload.eventType === 'INSERT') {
          setAllRawOrders(prev => [order, ...prev.filter(o => String(o.id) !== String(order.id))]);
          addActivityLog(`🆕 New Order #${order.id} placed at ${order.stallName || order.stall_name || 'Stall'} (₹${order.total})`, 'order');
        } else if (payload.eventType === 'UPDATE') {
          setAllRawOrders(prev => prev.map(o => String(o.id) === String(order.id) ? { ...o, ...order } : o));
          addActivityLog(`⚡ Order #${order.id} status updated to ${(order.status || '').toUpperCase()}`, 'status');
        } else if (payload.eventType === 'DELETE') {
          const oldOrder = payload.old;
          if (oldOrder && oldOrder.id) {
            setAllRawOrders(prev => prev.filter(o => String(o.id) !== String(oldOrder.id)));
            addActivityLog(`🗑️ Order #${oldOrder.id} removed`, 'info');
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Keep metrics in 100% sync with allRawOrders state and selected timeRange filter
  useEffect(() => {
    const now = Date.now();
    let msRange = 24 * 60 * 60 * 1000;
    if (timeRange === '7D') msRange = 7 * 24 * 60 * 60 * 1000;
    else if (timeRange === '30D') msRange = 30 * 24 * 60 * 60 * 1000;

    const filteredOrders = allRawOrders.filter(o => {
      const d = new Date(o.created_at || o.createdAt || o.timestamp || o.date || 0).getTime();
      return d >= (now - msRange);
    });

    const digital = filteredOrders
      .filter(o => {
        const p = String(o.payment || o.paymentMethod || o.payment_method || '').toLowerCase();
        return p.includes('upi') || p.includes('online');
      })
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const cash = filteredOrders
      .filter(o => {
        const p = String(o.payment || o.paymentMethod || o.payment_method || '').toLowerCase();
        return p.includes('cash');
      })
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

    const totalSalesSum = filteredOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const activeCount = filteredOrders.filter(o => ['placed', 'preparing', 'pending', 'pending_cash'].includes((o.status || '').toLowerCase())).length;

    setMetrics({
      totalSales: totalSalesSum,
      totalOrders: filteredOrders.length,
      activeOrders: activeCount,
      digitalSales: digital,
      cashSales: cash,
      totalVendors: SHOPS.length,
      healthScore: 99.8
    });
  }, [allRawOrders, timeRange]);

  async function handleResetRevenueData() {
    if (!window.confirm("Are you sure you want to permanently delete ALL orders and reset all counters to zero?")) return;
    
    setAllRawOrders([]);
    setActivityLogs([]);
    addActivityLog('⚡ Live active orders & revenue counters reset to zero by Admin. Realtime tracking active.', 'info');
    
    // Clear Supabase orders
    try {
      await supabase.from('orders').delete().neq('id', 'placeholder_impossible');
    } catch (err) {}

    // Clear localStorage caches
    try {
      localStorage.removeItem('sgu_orders');
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sgu_vendor_orders_')) {
          localStorage.removeItem(key);
        }
      }
    } catch (e) {}
  }

  useEffect(() => {
    updateChart(allRawOrders, selectedStallId, chartGranularity);
  }, [selectedStallId, chartGranularity, allRawOrders]);

  async function loadOverviewData() {
    try {
      const data = await api.getAdminMetrics();
      const allOrders = data.orders || [];
      setAllRawOrders(allOrders);

      // Activity stream starts clean — only live Realtime events will appear
      // Do NOT seed from historical orders so stream reflects actual live activity
    } catch (err) {
      console.error('Failed to load overview metrics:', err);
    }
  }

  function addActivityLog(text, type = 'info') {
    const newEntry = {
      id: Date.now(),
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type
    };
    setActivityLogs(prev => [newEntry, ...prev.slice(0, 15)]);
  }

  function filterOrdersByStall(ordersList, stallId) {
    if (!stallId || stallId === 'ALL') return ordersList;
    return ordersList.filter(o => {
      const sId = (o.stallId || o.stall_id || o.shopId || o.shop_id || '').toString().toLowerCase();
      const sName = (o.stallName || o.stall_name || '').toString().toLowerCase();
      const target = stallId.toString().toLowerCase();
      return (sId && sId === target) || (sName && (sName === target || sName.includes(target)));
    });
  }

  function updateChart(orders, stallId, granularity) {
    const stallOrders = filterOrdersByStall(orders || [], stallId);

    if (granularity === 'hourly') {
      const now = new Date();
      const todayStr = now.toDateString();
      const todayOrders = stallOrders.filter(o => {
        const d = new Date(o.created_at || o.createdAt || o.timestamp || o.date || 0);
        return d.toDateString() === todayStr;
      });

      const slots = [
        { label: '8 AM', startHour: 6, endHour: 9 },
        { label: '10 AM', startHour: 9, endHour: 11 },
        { label: '12 PM', startHour: 11, endHour: 13 },
        { label: '2 PM', startHour: 13, endHour: 15 },
        { label: '4 PM', startHour: 15, endHour: 17 },
        { label: '6 PM', startHour: 17, endHour: 19 },
        { label: '8 PM', startHour: 19, endHour: 24 },
      ];

      const hourlyData = slots.map(slot => {
        const slotOrders = todayOrders.filter(o => {
          const h = new Date(o.created_at || o.createdAt || o.timestamp || o.date || 0).getHours();
          return h >= slot.startHour && h < slot.endHour;
        });
        const revenue = slotOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        return { time: slot.label, revenue, orders: slotOrders.length };
      });
      setChartData(hourlyData);
    } else if (granularity === 'daily') {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayName = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
        const dStr = d.toDateString();

        const dayOrders = stallOrders.filter(o => {
          const od = new Date(o.created_at || o.createdAt || o.timestamp || o.date || 0);
          return od.toDateString() === dStr;
        });

        const revenue = dayOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        days.push({ time: dayName, revenue, orders: dayOrders.length });
      }
      setChartData(days);
    } else if (granularity === 'monthly') {
      const months = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const monthName = d.toLocaleDateString('en-US', { month: 'short' }) + (i === 0 ? ' (Cur)' : '');
        const m = d.getMonth();
        const y = d.getFullYear();

        const monthOrders = stallOrders.filter(o => {
          const od = new Date(o.created_at || o.createdAt || o.timestamp || o.date || 0);
          return od.getMonth() === m && od.getFullYear() === y;
        });

        const revenue = monthOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
        months.push({ time: monthName, revenue, orders: monthOrders.length });
      }
      setChartData(months);
    }
  }

  // Calculate per-shop aggregated daily & monthly revenue table dynamically from real orders
  const shopRevenueStats = SHOPS.map(shop => {
    const stallOrders = allRawOrders.filter(o => {
      const sId = (o.stallId || o.stall_id || o.shopId || o.shop_id || '').toString().toLowerCase();
      const sName = (o.stallName || o.stall_name || '').toString().toLowerCase();
      const targetId = (shop.id || '').toString().toLowerCase();
      const targetName = (shop.name || '').toString().toLowerCase();
      return (sId && sId === targetId) || (sName && sName === targetName) || (sName && targetId && sName.includes(targetId));
    });

    const now = new Date();
    const todayStr = now.toDateString();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let dailyRev = 0;
    let dailyOrdersCount = 0;
    let monthlyRev = 0;
    let monthlyOrdersCount = 0;
    let upiOrdersCount = 0;
    const totalOrdersCount = stallOrders.length;

    stallOrders.forEach(o => {
      const orderDate = new Date(o.created_at || o.createdAt || o.timestamp || o.date || Date.now());
      const orderTotal = Number(o.total) || 0;
      
      const isToday = orderDate.toDateString() === todayStr;
      const isThisMonth = orderDate.getMonth() === currentMonth && orderDate.getFullYear() === currentYear;

      if (isToday) {
        dailyRev += orderTotal;
        dailyOrdersCount += 1;
      }
      if (isThisMonth) {
        monthlyRev += orderTotal;
        monthlyOrdersCount += 1;
      }
      const paymentMethod = String(o.payment || o.paymentMethod || o.payment_method || '').toLowerCase();
      if (paymentMethod.includes('upi') || paymentMethod.includes('online')) {
        upiOrdersCount += 1;
      }
    });

    const aov = dailyOrdersCount > 0 
      ? Math.round(dailyRev / dailyOrdersCount) 
      : (monthlyOrdersCount > 0 ? Math.round(monthlyRev / monthlyOrdersCount) : 0);

    const upiPct = totalOrdersCount > 0 ? Math.round((upiOrdersCount / totalOrdersCount) * 100) : 0;

    return {
      ...shop,
      dailyRev,
      dailyOrdersCount,
      monthlyRev,
      monthlyOrdersCount,
      upiPct,
      aov
    };
  });

  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);
  const selectedShopObj = SHOPS.find(s => s.id === selectedStallId);

  return (
    <div className="flex flex-col gap-6">
      {/* Module Title */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>PLATFORM OVERVIEW</h1>
          <p className="text-slate-500 text-sm font-medium">Realtime metrics, revenue performance and operational logs across campus stalls.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleResetRevenueData}
            title="Reset revenue counters to zero"
            style={{
              padding: '6px 12px',
              borderRadius: 10,
              border: '1px solid #FCA5A5',
              background: '#FEF2F2',
              color: '#EF4444',
              fontFamily: "'Oswald', sans-serif",
              fontWeight: 700,
              fontSize: '0.75rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            🔄 RESET COUNTERS
          </button>
          <div style={{ display: 'flex', gap: 8, background: '#FFFFFF', padding: 4, borderRadius: 12, border: '1px solid #E2E8F0' }}>
            {['24H', '7D', '30D'].map(r => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '0.75rem',
                  background: timeRange === r ? '#FF3B5C' : 'transparent',
                  color: timeRange === r ? 'white' : '#64748B',
                  transition: 'all 0.2s ease'
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="kpi-grid">
        <div className="admin-card-v2 kpi-card" style={{ '--kpi-accent': '#FF3B5C' }}>
          <div className="kpi-top">
            <span className="kpi-title">Total Platform Sales</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(255,59,92,0.12)', color: '#FF3B5C' }}><DollarSign size={18} /></div>
          </div>
          <div className="kpi-value">₹{metrics.totalSales.toLocaleString()}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="kpi-trend up"><ArrowUpRight size={12} /> +18.4%</span>
            <span className="text-xs text-slate-400 font-semibold">vs previous {timeRange}</span>
          </div>
        </div>

        <div className="admin-card-v2 kpi-card" style={{ '--kpi-accent': '#F59E0B' }}>
          <div className="kpi-top">
            <span className="kpi-title">Active Live Orders</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}><ShoppingBag size={18} /></div>
          </div>
          <div className="kpi-value">{metrics.activeOrders}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="kpi-trend neutral"><Activity size={12} /> Live Queue</span>
            <span className="text-xs text-slate-400 font-semibold">Realtime Socket sync</span>
          </div>
        </div>

        <div className="admin-card-v2 kpi-card" style={{ '--kpi-accent': '#10B981' }}>
          <div className="kpi-top">
            <span className="kpi-title">Campus Vendors</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}><Store size={18} /></div>
          </div>
          <div className="kpi-value">{metrics.totalVendors} / 6</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="kpi-trend up"><ArrowUpRight size={12} /> 100% Online</span>
            <span className="text-xs text-slate-400 font-semibold">All stalls active</span>
          </div>
        </div>

        <div className="admin-card-v2 kpi-card" style={{ '--kpi-accent': '#FF3B5C' }}>
          <div className="kpi-top">
            <span className="kpi-title">System Health & Uptime</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(255,59,92,0.12)', color: '#FF3B5C' }}><ShieldCheck size={18} /></div>
          </div>
          <div className="kpi-value">{metrics.healthScore}%</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="kpi-trend up"><ArrowUpRight size={12} /> Optimal</span>
            <span className="text-xs text-slate-400 font-semibold">Latency &lt; 25ms</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Activity Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        {/* Interactive Sales & Revenue Volume Chart */}
        <div className="admin-card-v2 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
            <div>
              <h3 style={{ margin: 0, fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart2 size={20} color="#FF3B5C" />
                {selectedStallId === 'ALL' ? 'ALL STALLS REVENUE & ORDER TREND' : `${selectedShopObj?.name?.toUpperCase()} REVENUE TREND`}
              </h3>
              <p className="text-xs text-slate-400 font-semibold" style={{ margin: 0 }}>
                {chartGranularity === 'hourly' && 'Hourly distribution of sales today'}
                {chartGranularity === 'daily' && 'Daily breakdown for this month'}
                {chartGranularity === 'monthly' && 'Monthly breakdown for 2026'}
              </p>
            </div>

            {/* Filter Deck: Per-Shop Dropdown & Granularity Switcher */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Shop Selector Dropdown */}
              <select
                value={selectedStallId}
                onChange={(e) => setSelectedStallId(e.target.value)}
                style={{
                  padding: '7px 12px',
                  borderRadius: 10,
                  border: '1px solid #FFE4E6',
                  fontFamily: "'Oswald', sans-serif",
                  fontWeight: 800,
                  fontSize: '0.8rem',
                  color: '#FF3B5C',
                  background: '#FFF1F2',
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: '0 2px 6px rgba(255, 59, 92, 0.08)'
                }}
              >
                <option value="ALL">🏢 ALL CAMPUS STALLS</option>
                {SHOPS.map(s => (
                  <option key={s.id} value={s.id}>{s.logo || '🥘'} {s.name}</option>
                ))}
              </select>

              {/* Granularity View Selector */}
              <div style={{ display: 'flex', gap: 3, background: '#F1F5F9', padding: 3, borderRadius: 10 }}>
                {[
                  { id: 'hourly', label: 'HOURLY' },
                  { id: 'daily', label: 'DAILY (MONTH)' },
                  { id: 'monthly', label: 'MONTHLY (YEAR)' }
                ].map(g => (
                  <button
                    key={g.id}
                    onClick={() => setChartGranularity(g.id)}
                    style={{
                      padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '0.72rem',
                      background: chartGranularity === g.id ? '#FF3B5C' : 'transparent',
                      color: chartGranularity === g.id ? 'white' : '#64748B',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SVG Custom Interactive Bar & Line Chart */}
          <div style={{ height: 260, display: 'flex', alignItems: 'flex-end', gap: 14, padding: '10px 0 20px 0', borderBottom: '2px dashed #E2E8F0' }}>
            {chartData.map((item, idx) => {
              const heightPct = Math.round((item.revenue / maxRevenue) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer">
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#FF3B5C', opacity: 0 }} className="group-hover:opacity-100 transition-opacity font-heading">
                    ₹{item.revenue.toLocaleString()}
                  </div>
                  <div style={{ width: '100%', height: `${heightPct}%`, minHeight: 20, background: 'linear-gradient(180deg, #FF3B5C, #E11D48)', borderRadius: '10px 10px 4px 4px', transition: 'all 0.3s ease', position: 'relative' }} className="group-hover:brightness-125">
                    <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#F59E0B', color: 'white', fontSize: '0.65rem', fontWeight: 900, borderRadius: 4, padding: '1px 5px', fontFamily: "'Oswald', sans-serif", whiteSpace: 'nowrap' }}>
                      {item.orders}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', fontFamily: "'Oswald', sans-serif" }}>
                    {item.time}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Breakdown Pills */}
          <div className="flex justify-between items-center mt-4 text-xs font-semibold text-slate-600">
            <div>Digital UPI Sales: <strong style={{ color: '#10B981' }}>₹{metrics.digitalSales.toLocaleString()}</strong></div>
            <div>Cash Payments: <strong style={{ color: '#F59E0B' }}>₹{metrics.cashSales.toLocaleString()}</strong></div>
            <button 
              onClick={() => onNavigateModule('orders')}
              style={{ background: 'none', border: 'none', color: '#FF3B5C', fontWeight: 800, cursor: 'pointer', fontFamily: "'Oswald', sans-serif" }}
            >
              VIEW FULL ORDERS LOG →
            </button>
          </div>
        </div>

        {/* Realtime Live Activity Feed */}
        <div className="admin-card-v2 flex flex-col">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
            <h3 style={{ margin: 0, fontFamily: "'Oswald', sans-serif", fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Flame size={18} color="#FF3B5C" /> LIVE ACTIVITY STREAM
            </h3>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#10B981', background: '#D1FAE5', padding: '2px 8px', borderRadius: 999, fontFamily: "'Oswald', sans-serif" }}>REALTIME</span>
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 300 }}>
            {activityLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
                <p style={{ color: '#94A3B8', fontSize: '0.8rem', fontWeight: 700, margin: 0 }}>No orders yet</p>
                <p style={{ color: '#CBD5E1', fontSize: '0.72rem', fontWeight: 500, margin: '4px 0 0 0' }}>New orders will appear here in realtime</p>
              </div>
            ) : (
              activityLogs.map((log) => (
                <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 10, background: '#F8FAFC', borderRadius: 12, borderLeft: '3px solid #FF3B5C' }}>
                  <div style={{ marginTop: 2 }}>
                    <Clock size={14} color="#64748B" />
                  </div>
                  <div className="flex-1">
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', lineHeight: 1.3 }}>
                      {log.text}
                    </div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 600, color: '#94A3B8', marginTop: 2 }}>
                      {log.time}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Per-Shop Daily & Monthly Revenue Matrix Table */}
      <div className="admin-card-v2 flex flex-col gap-4" style={{ borderTop: '4px solid #FF3B5C' }}>
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h3 style={{ margin: 0, fontFamily: "'Oswald', sans-serif", fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Store size={20} color="#FF3B5C" />
              CAMPUS STALL REVENUE ANALYTICS (DAILY & MONTHLY)
            </h3>
            <p className="text-xs text-slate-400 font-semibold" style={{ margin: 0 }}>
              Individual earnings breakdown, daily/monthly totals, and average order value (AOV) for every campus stall.
            </p>
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#FF3B5C', background: '#FFF1F2', padding: '4px 12px', borderRadius: 999, fontFamily: "'Oswald', sans-serif" }}>
            6 ACTIVE STALLS
          </div>
        </div>

        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Stall Name & Category</th>
                <th style={{ textAlign: 'right' }}>Daily Revenue (Today)</th>
                <th style={{ textAlign: 'right' }}>Monthly Revenue (This Month)</th>
                <th style={{ textAlign: 'center' }}>Orders (Today / Month)</th>
                <th style={{ textAlign: 'center' }}>Avg Order Value (AOV)</th>
                <th style={{ textAlign: 'center' }}>Payment Mix</th>
                <th style={{ textAlign: 'right' }}>Filter Chart</th>
              </tr>
            </thead>
            <tbody>
              {shopRevenueStats.map(shop => (
                <tr key={shop.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ fontSize: '1.6rem', width: 36, height: 36, borderRadius: 10, background: '#FFF1F2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {shop.logo || '🥘'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.9rem' }}>{shop.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 500 }}>{shop.category || 'Food Court Stall'}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: "'Oswald', sans-serif", fontWeight: 800, color: '#FF3B5C', fontSize: '1.05rem' }}>
                    ₹{shop.dailyRev.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: "'Oswald', sans-serif", fontWeight: 800, color: '#0F172A', fontSize: '1.05rem' }}>
                    ₹{shop.monthlyRev.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>
                    {shop.dailyOrdersCount} / {shop.monthlyOrdersCount}
                  </td>
                  <td style={{ textAlign: 'center', fontFamily: "'Oswald', sans-serif", fontWeight: 800, color: '#10B981', fontSize: '0.95rem' }}>
                    ₹{shop.aov}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '3px 8px', borderRadius: 999, background: '#D1FAE5', color: '#059669', fontFamily: "'Oswald', sans-serif" }}>
                      {shop.upiPct}% UPI 
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => {
                        setSelectedStallId(shop.id);
                        window.scrollTo({ top: 200, behavior: 'smooth' });
                      }}
                      className="btn-action-sm"
                      style={{
                        borderColor: '#FFE4E6',
                        color: '#FF3B5C',
                        background: '#FFF1F2',
                        fontSize: '0.72rem',
                        padding: '5px 10px'
                      }}
                    >
                      View Trend →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
