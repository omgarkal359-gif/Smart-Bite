import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { LogOut, User, ShoppingBag, ArrowRight, ExternalLink, ShieldCheck } from 'lucide-react';
import { api, formatRelativeTime } from '../api';
import { supabase } from '../supabaseClient';
import { getStoredUser, setStoredUser, clearStoredUser } from '../utils/auth';
import './pages.css';
import './profile.css';

const UserProfile = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(() => {
    const saved = getStoredUser();
    if (saved) return saved;
    return { name: 'SGU Student', id: 'student@sgu.edu', role: 'student' };
  });

  const [recentOrders, setRecentOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadUserData() {
      try {
        const { data } = await supabase.auth.getUser().catch(() => ({ data: null }));
        const user = data?.user;

        let parsed = getStoredUser();

        if (!parsed && user) {
          parsed = {
            name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Student',
            id: user.email || user.phone || user.id,
            role: user.user_metadata?.role || 'student'
          };
          setStoredUser(parsed, false);
        }

        if (isMounted && parsed) {
          setUserData(parsed);
        }

        const customerId = (parsed?.id || parsed?.username || 'student').toString().trim().toLowerCase();

        try {
          const orders = await api.getStudentOrders(customerId);
          if (isMounted) {
            const validOrders = Array.isArray(orders) ? orders : [];
            setRecentOrders(validOrders);
            try {
              localStorage.setItem('sgu_orders', JSON.stringify(validOrders));
            } catch (_err) {}
          }
        } catch (_err) {
          if (isMounted) {
            try {
              const savedOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
              setRecentOrders(Array.isArray(savedOrders) ? savedOrders : []);
            } catch (_e) {
              setRecentOrders([]);
            }
          }
        }
      } catch (globalErr) {
        console.error('UserProfile load error:', globalErr);
      } finally {
        if (isMounted) setLoadingOrders(false);
      }
    }

    loadUserData();

    const parsed = getStoredUser();
    const customerId = parsed ? (parsed.id || parsed.username || 'student').toString().trim().toLowerCase() : null;
    
    let channel;
    if (customerId) {
      channel = supabase.channel(`student_orders_${customerId}`);
      channel.on('broadcast', { event: 'order_status_update' }, (payload) => {
        if (payload.payload && payload.payload.orderId) {
          setRecentOrders(prev => {
            const updated = prev.map(o => o.id === payload.payload.orderId ? { ...o, status: payload.payload.status } : o);
            try { localStorage.setItem('sgu_orders', JSON.stringify(updated)); } catch (_err) {}
            return updated;
          });
        }
      }).subscribe();
    }

    return () => { 
      isMounted = false; 
      if (channel) supabase.removeChannel(channel);
    };
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (_err) {}
    clearStoredUser();
    navigate('/login', { replace: true });
  };

  const safeOrdersList = Array.isArray(recentOrders) ? recentOrders : [];

  return (
    <div className="profile-container page-transition" style={{ minHeight: '100vh', background: '#F8FAFC', paddingBottom: 100 }}>
      <header className="glass-header menu-header" style={{ background: '#FFFFFF', padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#0F172A', margin: 0 }}>
          Student Profile
        </h1>
        <button 
          onClick={handleLogout}
          style={{ background: 'none', border: 'none', color: '#FF3B5C', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.85rem' }}
        >
          <LogOut size={18} /> Sign Out
        </button>
      </header>

      <main className="profile-main" style={{ padding: '20px', maxWidth: 600, margin: '0 auto' }}>
        {/* User Info Card */}
        <GlassCard className="profile-card user-info animate-stagger-item stagger-delay-1" style={{ background: '#FFFFFF', borderRadius: 20, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 16, padding: '32px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div className="avatar-placeholder" style={{ width: 80, height: 80, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '50%', background: '#FF3B5C', color: 'white', boxShadow: '0 8px 20px rgba(255,59,92,0.3)' }}>
            <User size={40} />
          </div>
          <div className="user-details" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <h2 style={{ textTransform: 'capitalize', fontSize: '1.5rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>
              {userData?.name || 'SGU Student'}
            </h2>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#64748B' }}>
              {userData?.username || userData?.id || 'student@sgu.edu'}
            </p>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '6px 16px', borderRadius: 999, background: '#FFF1F2', color: '#FF3B5C', textTransform: 'uppercase', marginTop: 4, display: 'inline-block' }}>
              Role: {userData?.role ? userData.role.toUpperCase() : 'STUDENT'}
            </span>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700, color: '#16A34A', background: '#F0FDF4', padding: '6px 16px', borderRadius: 999, border: '1px solid #DCFCE7' }}>
              <ShieldCheck size={14} /> Verified Student Account
            </div>
          </div>
        </GlassCard>

        {/* Real Placed Recent Orders Section */}
        <div className="history-section animate-stagger-item stagger-delay-3" style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748B' }}>
              Recent Orders & Placed Receipts
            </h3>
            {safeOrdersList.length > 0 && (
              <button 
                onClick={() => navigate('/student/orders')}
                style={{ background: 'none', border: 'none', color: '#FF3B5C', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                View All ({safeOrdersList.length}) <ArrowRight size={14} />
              </button>
            )}
          </div>

          {loadingOrders ? (
            <GlassCard style={{ textAlign: 'center', padding: '24px', background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748B', fontWeight: 600 }}>Loading your recent orders...</p>
            </GlassCard>
          ) : safeOrdersList.length === 0 ? (
            <GlassCard className="history-card" style={{ textAlign: 'center', padding: '28px 16px', background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0' }}>
              <ShoppingBag size={36} style={{ color: '#94A3B8', marginBottom: '10px', opacity: 0.5 }} />
              <p style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.95rem', margin: '0 0 4px 0' }}>No active orders placed yet</p>
              <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 16px 0' }}>Hungry? Explore campus stalls and order food in seconds!</p>
              <Button variant="secondary" style={{ fontSize: '0.82rem', padding: '10px 20px', borderRadius: 999 }} onClick={() => navigate('/student')}>
                <ShoppingBag size={15} /> Browse Menu
              </Button>
            </GlassCard>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {safeOrdersList.slice(0, 5).map((order, idx) => {
                if (!order) return null;
                const itemsText = typeof order.items === 'string' 
                  ? order.items 
                  : Array.isArray(order.items) 
                    ? order.items.map(i => typeof i === 'string' ? i : `${i.quantity}x ${i.name}`).join(', ')
                    : '';

                const isReady = order.status === 'ready';
                const isPrep = order.status === 'preparing' || order.status === 'placed';
                const statusColor = isReady ? '#22C55E' : isPrep ? '#FF3B5C' : '#64748B';
                const statusBg = isReady ? '#DCFCE7' : isPrep ? '#FFF1F2' : '#F1F5F9';
                const statusLabel = order.status === 'ready' ? 'READY FOR PICKUP' : 
                                    order.status === 'preparing' ? 'PREPARING' : 
                                    order.status === 'placed' ? 'ORDER PLACED' : 'COMPLETED';

                return (
                  <GlassCard 
                    key={order.id || idx}
                    onClick={() => navigate(`/student/order/${order.id || ''}`)}
                    style={{
                      padding: '16px',
                      cursor: 'pointer',
                      borderLeft: `5px solid ${statusColor}`,
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      background: '#FFFFFF',
                      borderRadius: 16,
                      border: '1px solid #E2E8F0',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
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
                        ₹{order.total || 0}
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

        <Button variant="secondary" className="btn-logout mt-6 tap-effect animate-stagger-item stagger-delay-4" onClick={handleLogout} style={{ width: '100%', marginTop: 24 }}>
          <LogOut size={18} /> Logout
        </Button>
      </main>
    </div>
  );
};

export default UserProfile;
