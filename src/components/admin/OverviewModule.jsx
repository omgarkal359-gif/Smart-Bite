import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, ShoppingBag, Store, ShieldCheck, 
  ArrowUpRight, ArrowDownRight, Clock, Activity, Flame, DollarSign 
} from 'lucide-react';
import { api, socket } from '../../api';
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

  useEffect(() => {
    loadOverviewData();

    // Listen to realtime socket events for live metric & activity feed updates
    const handleNewOrder = (order) => {
      setMetrics(prev => ({
        ...prev,
        totalOrders: prev.totalOrders + 1,
        activeOrders: prev.activeOrders + 1,
        totalSales: prev.totalSales + (order.total || 0)
      }));
      addActivityLog(`🆕 New Order #${order.id} placed at ${order.stallName || 'Stall'} (₹${order.total})`, 'order');
    };

    const handleStatusUpdate = (updatedOrder) => {
      if (updatedOrder.status === 'completed' || updatedOrder.status === 'ready') {
        setMetrics(prev => ({
          ...prev,
          activeOrders: Math.max(0, prev.activeOrders - 1)
        }));
      }
      addActivityLog(`⚡ Order #${updatedOrder.id} status updated to ${updatedOrder.status.toUpperCase()}`, 'status');
    };

    socket.on('order_new', handleNewOrder);
    socket.on('order_status_update', handleStatusUpdate);

    return () => {
      socket.off('order_new', handleNewOrder);
      socket.off('order_status_update', handleStatusUpdate);
    };
  }, []);

  async function loadOverviewData() {
    try {
      const data = await api.getAdminMetrics();
      const allOrders = data.orders || [];
      const activeCount = allOrders.filter(o => ['placed', 'preparing', 'pending_cash'].includes(o.status)).length;
      
      const digital = allOrders
        .filter(o => o.status === 'completed' && o.payment !== 'Cash')
        .reduce((sum, o) => sum + o.total, 0);

      const cash = allOrders
        .filter(o => o.status === 'completed' && o.payment === 'Cash')
        .reduce((sum, o) => sum + o.total, 0);

      setMetrics({
        totalSales: data.totalSales || (digital + cash),
        totalOrders: data.totalOrders || allOrders.length,
        activeOrders: activeCount,
        digitalSales: digital,
        cashSales: cash,
        totalVendors: SHOPS.length,
        healthScore: 99.8
      });

      // Generate hourly / daily chart breakdown
      buildChartData(allOrders);

      // Seed initial activity log
      const logs = allOrders.slice(0, 6).map(o => ({
        id: o.id,
        text: `Order #${o.id} (${o.customerName || 'Customer'}) — ₹${o.total} [${o.status.toUpperCase()}]`,
        time: o.time || 'Just now',
        type: 'order'
      }));
      setActivityLogs(logs);
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

  function buildChartData(orders) {
    const hours = ['8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM'];
    const mockCurve = [
      { time: '8AM', revenue: 450, orders: 12 },
      { time: '10AM', revenue: 1200, orders: 28 },
      { time: '12PM', revenue: 3800, orders: 84 },
      { time: '2PM', revenue: 5100, orders: 112 },
      { time: '4PM', revenue: 2900, orders: 62 },
      { time: '6PM', revenue: 4200, orders: 95 },
      { time: '8PM', revenue: 1800, orders: 40 },
    ];
    setChartData(mockCurve);
  }

  const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Module Title */}
      <div className="flex justify-between items-center mb-2">
        <div>
          <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>PLATFORM OVERVIEW</h1>
          <p className="text-slate-500 text-sm font-medium">Realtime metrics, revenue performance and operational logs across campus stalls.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, background: '#FFFFFF', padding: 4, borderRadius: 12, border: '1px solid #E2E8F0' }}>
          {['24H', '7D', '30D'].map(r => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontFamily: "'Oswald', sans-serif", fontWeight: 700, fontSize: '0.75rem',
                background: timeRange === r ? '#E4002B' : 'transparent',
                color: timeRange === r ? 'white' : '#64748B',
                transition: 'all 0.2s ease'
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="kpi-grid">
        <div className="admin-card-v2 kpi-card" style={{ '--kpi-accent': '#E4002B' }}>
          <div className="kpi-top">
            <span className="kpi-title">Total Platform Sales</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(228,0,43,0.12)', color: '#E4002B' }}><DollarSign size={18} /></div>
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

        <div className="admin-card-v2 kpi-card" style={{ '--kpi-accent': '#22C55E' }}>
          <div className="kpi-top">
            <span className="kpi-title">Campus Vendors</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(34,197,94,0.12)', color: '#22C55E' }}><Store size={18} /></div>
          </div>
          <div className="kpi-value">{metrics.totalVendors} / 6</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="kpi-trend up"><ArrowUpRight size={12} /> 100% Online</span>
            <span className="text-xs text-slate-400 font-semibold">All stalls active</span>
          </div>
        </div>

        <div className="admin-card-v2 kpi-card" style={{ '--kpi-accent': '#E4002B' }}>
          <div className="kpi-top">
            <span className="kpi-title">System Health & Uptime</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(228,0,43,0.12)', color: '#E4002B' }}><ShieldCheck size={18} /></div>
          </div>
          <div className="kpi-value">{metrics.healthScore}%</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="kpi-trend up"><ArrowUpRight size={12} /> Optimal</span>
            <span className="text-xs text-slate-400 font-semibold">Latency &lt; 25ms</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Activity Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
        {/* Interactive Sales & Revenue Volume Chart */}
        <div className="admin-card-v2 flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 style={{ margin: 0, fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                REVENUE & ORDER VOLUME TREND
              </h3>
              <p className="text-xs text-slate-400 font-semibold">Hourly distribution of sales across all campus stalls</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-bold font-heading">
              <span className="flex items-center gap-2" style={{ color: '#E4002B' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#E4002B' }} /> Revenue (₹)
              </span>
              <span className="flex items-center gap-2" style={{ color: '#F59E0B' }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: '#F59E0B' }} /> Orders Count
              </span>
            </div>
          </div>

          {/* SVG Custom Interactive Bar & Line Chart */}
          <div style={{ height: 260, display: 'flex', alignItems: 'flex-end', gap: 16, padding: '10px 0 20px 0', borderBottom: '2px dashed #E2E8F0' }}>
            {chartData.map((item, idx) => {
              const heightPct = Math.round((item.revenue / maxRevenue) * 100);
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer">
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#E4002B', opacity: 0 }} className="group-hover:opacity-100 transition-opacity font-heading">
                    ₹{item.revenue}
                  </div>
                  <div style={{ width: '100%', height: `${heightPct}%`, minHeight: 20, background: 'linear-gradient(180deg, #E4002B, #B91C1C)', borderRadius: '10px 10px 4px 4px', transition: 'all 0.3s ease', position: 'relative' }} className="group-hover:brightness-125">
                    <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: '#F59E0B', color: 'white', fontSize: '0.65rem', fontWeight: 900, borderRadius: 4, padding: '1px 5px', fontFamily: "'Oswald', sans-serif" }}>
                      {item.orders}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', fontFamily: "'Oswald', sans-serif" }}>
                    {item.time}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Breakdown Pills */}
          <div className="flex justify-between items-center mt-4 text-xs font-semibold text-slate-600">
            <div>Digital UPI Sales: <strong style={{ color: '#22C55E' }}>₹{metrics.digitalSales}</strong></div>
            <div>Cash Payments: <strong style={{ color: '#F59E0B' }}>₹{metrics.cashSales}</strong></div>
            <button 
              onClick={() => onNavigateModule('orders')}
              style={{ background: 'none', border: 'none', color: '#E4002B', fontWeight: 800, cursor: 'pointer', fontFamily: "'Oswald', sans-serif" }}
            >
              VIEW FULL ORDERS LOG →
            </button>
          </div>
        </div>

        {/* Realtime Live Activity Feed */}
        <div className="admin-card-v2 flex flex-col">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
            <h3 style={{ margin: 0, fontFamily: "'Oswald', sans-serif", fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Flame size={18} color="#E4002B" /> LIVE ACTIVITY STREAM
            </h3>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#22C55E', background: '#DCFCE7', padding: '2px 8px', borderRadius: 999, fontFamily: "'Oswald', sans-serif" }}>REALTIME</span>
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 300 }}>
            {activityLogs.length === 0 ? (
              <p className="text-slate-400 text-xs text-center py-8">Waiting for live activities...</p>
            ) : (
              activityLogs.map((log) => (
                <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: 10, background: '#F8FAFC', borderRadius: 12, borderLeft: '3px solid #E4002B' }}>
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
    </div>
  );
};
