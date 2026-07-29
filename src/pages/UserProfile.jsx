import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { LogOut, User, Clock, ShoppingBag, ArrowRight, ExternalLink, CheckCircle } from 'lucide-react';
import { api, socket, formatRelativeTime } from '../api';
import './pages.css';
import './profile.css';

const UserProfile = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    const savedSession = localStorage.getItem('sgu_user');
    if (!savedSession) {
      navigate('/login', { replace: true });
      return;
    }

    const parsed = JSON.parse(savedSession);
    setUserData(parsed);
    const customerId = (parsed.id || parsed.username || '9876543210').trim().toLowerCase();

    async function loadOrders() {
      try {
        const orders = await api.getStudentOrders(customerId);
        setRecentOrders(orders);
        localStorage.setItem('sgu_orders', JSON.stringify(orders));
      } catch (err) {
        console.error('Failed to load user orders:', err);
        const savedOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
        setRecentOrders(savedOrders);
      } finally {
        setLoadingOrders(false);
      }
    }

    loadOrders();

    // Listen to real-time status updates for student's orders
    socket.emit('join', 'student');

    const handleStatusUpdate = (updatedOrder) => {
      const updatedCustId = (updatedOrder.customerId || updatedOrder.customerid || '').trim().toLowerCase();
      if (updatedCustId && updatedCustId !== customerId) return;

      setRecentOrders(prev => {
        if (!prev.some(order => order.id === updatedOrder.id)) {
          return [updatedOrder, ...prev];
        }
        return prev.map(order => order.id === updatedOrder.id ? updatedOrder : order);
      });
    };

    socket.on('order_status_update', handleStatusUpdate);
    const interval = setInterval(loadOrders, 8000);

    return () => {
      socket.off('order_status_update', handleStatusUpdate);
      clearInterval(interval);
    };
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('sgu_token');
    localStorage.removeItem('sgu_user');
    localStorage.removeItem('sgu_cart'); // Clear cart on logout for security
    navigate('/login', { replace: true });
  };

  return (
    <div className="profile-container page-transition">
      <header className="glass-header menu-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.02em', color: 'var(--text-dark)', margin: 0 }}>Profile</h1>
        <div style={{ transform: 'scale(1.2)' }}>
          <UserButton afterSignOutUrl="/login" />
        </div>
      </header>

      <main className="profile-main">
        {/* User Info Card */}
        <GlassCard className="profile-card user-info animate-stagger-item stagger-delay-1" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="avatar-placeholder">
              <User size={40} />
            </div>
            <div className="user-details">
              <h2 style={{ textTransform: 'capitalize' }}>{userData?.name || 'SGU Student'}</h2>
              <p className="text-muted">{userData?.username || userData?.id || '+91 -'}</p>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: '#FFF1F2', color: '#FF3B5C', textTransform: 'uppercase', marginTop: 4, display: 'inline-block' }}>
                Role: {userData?.role ? userData.role.toUpperCase() : 'STUDENT'}
              </span>
            </div>
          </div>

          <div>
            <UserButton afterSignOutUrl="/login" />
          </div>
        </GlassCard>

        {/* Real Placed Recent Orders Section */}
        <div className="history-section animate-stagger-item stagger-delay-3" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title text-muted" style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Recent Orders & Placed Receipts
            </h3>
            {recentOrders.length > 0 && (
              <button 
                onClick={() => navigate('/student/orders')}
                style={{ background: 'none', border: 'none', color: '#FF3B5C', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                View All ({recentOrders.length}) <ArrowRight size={14} />
              </button>
            )}
          </div>

          {loadingOrders ? (
            <GlassCard style={{ textAlign: 'center', padding: '24px' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>Loading your recent orders...</p>
            </GlassCard>
          ) : recentOrders.length === 0 ? (
            <GlassCard className="history-card" style={{ textAlign: 'center', padding: '28px 16px' }}>
              <ShoppingBag size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px', opacity: 0.4 }} />
              <p style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.95rem', margin: '0 0 4px 0' }}>No active orders placed yet</p>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 16px 0' }}>Hungry? Explore campus stalls and order food in seconds!</p>
              <Button variant="secondary" style={{ fontSize: '0.82rem', padding: '10px 20px', borderRadius: 999 }} onClick={() => navigate('/student')}>
                <ShoppingBag size={15} /> Browse Menu
              </Button>
            </GlassCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recentOrders.slice(0, 5).map((order) => {
                const itemsText = typeof order.items === 'string' 
                  ? order.items 
                  : Array.isArray(order.items) 
                    ? order.items.map(i => typeof i === 'string' ? i : `${i.quantity}x ${i.name}`).join(', ')
                    : '';

                const isReady = order.status === 'ready';
                const isPrep = order.status === 'preparing' || order.status === 'placed' || order.status === 'pending_cash';
                const statusColor = isReady ? '#22C55E' : isPrep ? '#FF3B5C' : '#64748B';
                const statusBg = isReady ? '#DCFCE7' : isPrep ? '#FFF1F2' : '#F1F5F9';
                const statusLabel = order.status === 'ready' ? 'READY FOR PICKUP' : 
                                    order.status === 'preparing' ? 'PREPARING' : 
                                    order.status === 'pending_cash' ? 'CASH PENDING' : 
                                    order.status === 'placed' ? 'ORDER PLACED' : 'COMPLETED';

                return (
                  <GlassCard 
                    key={order.id}
                    onClick={() => navigate(`/student/order/${order.id}`)}
                    style={{
                      padding: '16px',
                      cursor: 'pointer',
                      borderLeft: `5px solid ${statusColor}`,
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      background: 'var(--white)',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 900, fontSize: '1rem', color: '#0F172A', fontFamily: "'Oswald', sans-serif" }}>
                          #{order.id}
                        </span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '3px 8px', borderRadius: 999, background: statusBg, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {statusLabel}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.72rem', color: '#64748B', fontWeight: 600 }}>
                        {order.timestamp ? formatRelativeTime(order.timestamp) : 'Recent'}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.84rem', color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {itemsText || 'Standard Food Order'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px dashed #E2E8F0', marginTop: 2 }}>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0F172A', fontFamily: "'Oswald', sans-serif" }}>
                        ₹{order.total}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#FF3B5C', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Track Ticket & QR <ExternalLink size={13} />
                      </span>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </div>

        <Button variant="secondary" className="btn-logout mt-6 tap-effect animate-stagger-item stagger-delay-4" onClick={handleLogout}>
          <LogOut size={18} /> Logout
        </Button>
      </main>
    </div>
  );
};

export default UserProfile;
