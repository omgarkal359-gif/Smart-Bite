import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Store, Search, Filter, RefreshCw, 
  CheckCircle, AlertTriangle, Clock, Banknote, Smartphone, ShieldAlert, Utensils
} from 'lucide-react';
import { api } from '../../api';
import { supabase } from '../../supabaseClient';
import { SHOPS } from '../../data/foodCourtDB';

export const OrdersVendorsModule = () => {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'vendors'
  const [orders, setOrders] = useState([]);
  const [stalls, setStalls] = useState(SHOPS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStall, setSelectedStall] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();

    // Supabase Realtime subscription for live order updates
    const channel = supabase
      .channel('admin-orders-module')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setOrders(prev => [payload.new, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [orderQueue, stallList] = await Promise.all([
        api.getOrderQueue(),
        api.getStalls()
      ]);
      setOrders(orderQueue || []);
      if (stallList && stallList.length) setStalls(stallList);
    } catch (err) {
      console.error('Failed to load admin orders & stalls:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Handle Order Status Override
  async function handleOverrideStatus(orderId, newStatus) {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    } catch (err) {
      alert('Failed to override status: ' + err.message);
    }
  }

  // Handle Stall Toggle Online/Offline
  async function handleToggleStall(stallId, currentOnline) {
    try {
      const newStatus = !currentOnline;
      await api.updateStallStatus(stallId, { online: newStatus });
      setStalls(prev => prev.map(s => s.id === stallId ? { ...s, online: newStatus ? 1 : 0 } : s));
    } catch (err) {
      alert('Failed to update stall: ' + err.message);
    }
  }

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery = !q || 
      (o.id && o.id.toString().toLowerCase().includes(q)) ||
      (o.customerName && o.customerName.toLowerCase().includes(q)) ||
      (o.payment && o.payment.toLowerCase().includes(q));

    const matchStall = selectedStall === 'ALL' || o.stallId === selectedStall;
    const matchStatus = selectedStatus === 'ALL' || o.status === selectedStatus;

    return matchQuery && matchStall && matchStatus;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Sub-Tab Switcher */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>ORDER & VENDOR MANAGEMENT</h1>
          <p className="text-slate-500 text-sm font-medium">Master control table for campus orders and vendor stall operations.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, background: '#FFFFFF', padding: 4, borderRadius: 12, border: '1px solid #E2E8F0' }}>
          <button
            onClick={() => setActiveTab('orders')}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.8rem',
              background: activeTab === 'orders' ? '#FF3B5C' : 'transparent',
              color: activeTab === 'orders' ? 'white' : '#64748B',
              transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            <ShoppingBag size={15} /> ALL CAMPUS ORDERS ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.8rem',
              background: activeTab === 'vendors' ? '#FF3B5C' : 'transparent',
              color: activeTab === 'vendors' ? 'white' : '#64748B',
              transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            <Store size={15} /> VENDOR STALLS ({stalls.length})
          </button>
        </div>
      </div>

      {activeTab === 'orders' ? (
        /* ORDERS MANAGEMENT MODULE */
        <div className="admin-card-v2 flex flex-col gap-4">
          {/* Filters Deck */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 12, flex: 1, minWidth: 280 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="Search by order ID, customer name, payment..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10,
                    border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.85rem', fontWeight: 600
                  }}
                />
              </div>

              {/* Stall Filter */}
              <select
                value={selectedStall}
                onChange={e => setSelectedStall(e.target.value)}
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.85rem', fontWeight: 700, fontFamily: "'Oswald', sans-serif", color: '#FF3B5C', cursor: 'pointer' }}
              >
                <option value="ALL">ALL STALLS</option>
                {SHOPS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.85rem', fontWeight: 700, fontFamily: "'Oswald', sans-serif", color: '#FF3B5C', cursor: 'pointer' }}
              >
                <option value="ALL">ALL STATUSES</option>
                <option value="placed">PLACED</option>
                <option value="preparing">PREPARING</option>
                <option value="ready">READY</option>
                <option value="completed">COMPLETED</option>
                <option value="pending_cash">AWAITING CASH</option>
              </select>
            </div>

            <button 
              onClick={loadData}
              className="btn-action-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} /> Refresh Data
            </button>
          </div>

          {/* Master Order Table */}
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Type & Payment</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th style={{ textAlign: 'right' }}>Admin Overrides</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                      No orders matching current filter parameters.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => (
                    <tr key={order.id}>
                      <td style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 800, color: '#FF3B5C', fontSize: '1rem' }}>
                        #{order.id}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{order.customerName || 'Standard Order'}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{order.customerId || 'Student'}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: '#F1F5F9', color: '#475569' }}>
                            {order.type || 'Dine-In'}
                          </span>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: 6, background: order.payment === 'Online UPI' ? '#DCFCE7' : '#FEF3C7', color: order.payment === 'Online UPI' ? '#15803D' : '#D97706' }}>
                            {order.payment || 'Cash'}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 800, color: '#0F172A', fontSize: '1.1rem' }}>
                        ₹{order.total}
                      </td>
                      <td>
                        <span className={`status-pill ${order.status || 'placed'}`}>
                          {order.status ? order.status.toUpperCase() : 'PLACED'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748B' }}>
                        {order.time || 'Just now'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button 
                            className="btn-action-sm"
                            onClick={() => handleOverrideStatus(order.id, 'preparing')}
                            disabled={order.status === 'preparing'}
                          >
                            Preparing
                          </button>
                          <button 
                            className="btn-action-sm"
                            style={{ borderColor: '#86EFAC', color: '#166534', background: '#F0FDF4' }}
                            onClick={() => handleOverrideStatus(order.id, 'ready')}
                            disabled={order.status === 'ready'}
                          >
                            Ready
                          </button>
                          <button 
                            className="btn-action-sm btn-action-danger"
                            onClick={() => handleOverrideStatus(order.id, 'cancelled')}
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VENDOR STALLS MODULE */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {stalls.map(stall => {
            const isOnline = stall.online === 1 || stall.online === true;
            return (
              <div key={stall.id} className="admin-card-v2 flex flex-col justify-between" style={{ borderTop: `4px solid ${isOnline ? '#22C55E' : '#64748B'}` }}>
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div style={{ fontSize: '2rem' }}>{stall.logo || '🥘'}</div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 900, padding: '4px 10px', borderRadius: 999, background: isOnline ? '#DCFCE7' : '#F1F5F9', color: isOnline ? '#15803D' : '#64748B', fontFamily: "'Oswald', sans-serif" }}>
                      {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
                    {stall.name}
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 16px 0', fontWeight: 500 }}>
                    {stall.category || 'Food Court Stall'}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex flex-col gap-3">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-600">
                    <span>Rating: <strong>⭐ {stall.rating || 4.5}</strong></span>
                    <span>Wait Time: <strong>{stall.waitTime || 0} mins</strong></span>
                  </div>
                  <button
                    onClick={() => handleToggleStall(stall.id, isOnline)}
                    style={{
                      width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase',
                      background: isOnline ? '#FEE2E2' : '#DCFCE7',
                      color: isOnline ? '#DC2626' : '#15803D',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isOnline ? 'FORCE CLOSE SHOP' : 'FORCE OPEN SHOP'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
