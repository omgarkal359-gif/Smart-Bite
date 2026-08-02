import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, ShoppingBag } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { api, socket, formatRelativeTime } from '../api';
import { supabase } from '../supabaseClient';
import './home_v21.css';

const OrdersPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('sgu_user') || '{}');
    const customerId = userData.id || userData.username || '9876543210';

    async function fetchOrders() {
      try {
        const liveOrders = await api.getStudentOrders(customerId);
        setOrders(liveOrders || []);
        // Keep localStorage in sync with latest from DB
        if (liveOrders && liveOrders.length > 0) {
          localStorage.setItem('sgu_orders', JSON.stringify(liveOrders));
        }
      } catch (err) {
        console.error('Failed to fetch student orders:', err);
        // Fallback to localStorage
        const savedOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
        setOrders(savedOrders);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOrders();

    // ── Socket listener (legacy no-op in this app, kept for future) ──
    socket.emit('join', 'student');
    const handleSocketStatusUpdate = (updatedOrder) => {
      setOrders(prev =>
        prev.map(o => o.id === updatedOrder.id ? { ...o, status: updatedOrder.status } : o)
      );
    };
    socket.on('order_status_update', handleSocketStatusUpdate);

    // ── Supabase Realtime: subscribe to all order status updates for this student ──
    // We watch the global student_sync channel, keyed by order ID for each known order
    // But since we don't know all order IDs upfront, we poll AND listen to a global channel
    const studentSyncChannel = supabase
      .channel(`student_orders_${customerId}`)
      .on('broadcast', { event: 'order_status_update' }, (payload) => {
        const orderId = payload?.orderId || payload?.payload?.orderId || payload?.order_id || payload?.payload?.order_id;
        const status = payload?.status || payload?.payload?.status;
        if (!orderId || !status) return;
        // Update the order in state
        setOrders(prev => {
          const updated = prev.map(o =>
            (o.id === orderId || String(o.id) === String(orderId))
              ? { ...o, status }
              : o
          );
          // Also update localStorage
          localStorage.setItem('sgu_orders', JSON.stringify(updated));
          return updated;
        });
      })
      .subscribe();

    // ── Polling fallback every 6 seconds ──
    const interval = setInterval(fetchOrders, 6000);

    return () => {
      socket.off('order_status_update', handleSocketStatusUpdate);
      supabase.removeChannel(studentSyncChannel);
      clearInterval(interval);
    };
  }, []);

  // Also subscribe to each individual order's sync channel (for DigitalReceiptTracker compatibility)
  React.useEffect(() => {
    if (orders.length === 0) return;
    const channels = orders
      .filter(o => o.status !== 'completed')
      .slice(0, 5) // Subscribe to top 5 active orders only
      .map(order => {
        const ch = supabase
          .channel(`student_sync_${order.id}`)
          .on('broadcast', { event: 'order_status_update' }, (payload) => {
            const orderId = payload?.orderId || payload?.payload?.orderId || payload?.order_id || payload?.payload?.order_id;
            const status = payload?.status || payload?.payload?.status;
            if (!orderId || !status) return;
            setOrders(prev => {
              const updated = prev.map(o =>
                (o.id === orderId || String(o.id) === String(orderId))
                  ? { ...o, status }
                  : o
              );
              localStorage.setItem('sgu_orders', JSON.stringify(updated));
              return updated;
            });
          })
          .subscribe();
        return ch;
      });

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [orders.length]);

  const [displayLimit, setDisplayLimit] = React.useState(10);
  const visibleOrders = orders.slice(0, displayLimit);
  const hasMore = orders.length > displayLimit;

  return (
    <div className="directory-container page-transition">
      <main className="shop-main-content" style={{ paddingTop: '24px' }}>
        <h2 className="heading-2 section-title-home mb-6">My Orders</h2>
        
        <div className="flex flex-col gap-4">
          {isLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontWeight: 600 }}>
              Loading your orders...
            </div>
          )}

          {!isLoading && orders.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                textAlign: 'center',
              }}
            >
              <ShoppingBag size={56} style={{ color: 'var(--text-muted)', marginBottom: '16px', opacity: 0.4 }} />
              <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '6px' }}>No orders yet</p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Your orders will appear here once you place one.</p>
            </motion.div>
          )}

          {visibleOrders.map((order, i) => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <GlassCard 
                className={`shop-card-v21 tap-effect shadow-sm transition-all ${order.status === 'completed' ? 'opacity-75' : ''}`}
                style={{ 
                  borderLeft: (order.status === 'prep' || order.status === 'preparing') ? '6px solid #E4002B' : 
                              order.status === 'ready' ? '6px solid var(--success-green)' : 
                              order.status === 'pending_cash' ? '6px solid #F59E0B' :
                              order.status === 'placed' ? '6px solid #8B5CF6' :
                              '1px solid #EEEEEE',
                  padding: '16px',
                  borderRadius: '16px',
                  cursor: 'pointer',
                }}
                onClick={() => navigate(`/student/order/${order.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ 
                      fontFamily: 'var(--font-heading)', 
                      fontWeight: 800, 
                      fontSize: '1.05rem', 
                      color: 'var(--text-dark)',
                      letterSpacing: '-0.5px',
                    }}>{order.id}</span>
                    <span style={{ 
                      fontWeight: 700, 
                      fontSize: '0.7rem', 
                      color: 'var(--text-muted)', 
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>{order.timestamp || order.created_at ? formatRelativeTime(order.timestamp || order.created_at).toUpperCase() : (order.time || 'Just now').toUpperCase()}</span>
                  </div>

                  {/* Items */}
                  <p style={{ 
                    fontWeight: 600, 
                    fontSize: '0.85rem', 
                    color: '#64748B',
                    lineHeight: '1.4',
                    margin: '6px 0',
                  }}>
                    {typeof order.items === 'string' 
                      ? order.items 
                      : Array.isArray(order.items) 
                        ? order.items.map(item => typeof item === 'string' ? item : `${item.quantity}x ${item.name}`).join(', ') 
                        : ''}
                  </p>

                  {/* Price & Status */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderTop: '1px solid #F1F5F9',
                    paddingTop: '8px',
                    marginTop: '4px',
                  }}>
                    <span style={{ 
                      fontFamily: 'var(--font-heading)', 
                      fontWeight: 800, 
                      fontSize: '1.2rem', 
                      color: 'var(--text-dark)' 
                    }}>₹{order.total}</span>
                    
                    {(order.status === 'placed') && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: '#8B5CF6', color: 'white',
                        fontWeight: 800, fontSize: '0.65rem',
                        padding: '4px 10px', borderRadius: '20px',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                      }}>
                        <Clock size={11} /> Order Placed
                      </span>
                    )}
                    {order.status === 'pending_cash' && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: '#F59E0B', color: 'white',
                        fontWeight: 800, fontSize: '0.65rem',
                        padding: '4px 10px', borderRadius: '20px',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                      }}>
                        <Clock size={11} /> Awaiting Cash
                      </span>
                    )}
                    {(order.status === 'preparing' || order.status === 'prep') && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: '#E4002B', color: 'white',
                        fontWeight: 800, fontSize: '0.65rem',
                        padding: '4px 10px', borderRadius: '20px',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        boxShadow: '0 2px 8px rgba(228, 0, 43, 0.3)',
                        animation: 'pulse 1.5s infinite',
                      }}>
                        <Clock size={11} /> 🔥 Preparing
                      </span>
                    )}
                    {order.status === 'ready' && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: '#22C55E', color: 'white',
                        fontWeight: 800, fontSize: '0.65rem',
                        padding: '4px 10px', borderRadius: '20px',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
                      }}>
                        <CheckCircle size={11} /> ✅ Pick up Now!
                      </span>
                    )}
                    {order.status === 'completed' && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: '#F1F5F9', color: '#64748B',
                        fontWeight: 800, fontSize: '0.65rem',
                        padding: '4px 10px', borderRadius: '20px',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                      }}>
                        <CheckCircle size={11} /> Completed
                      </span>
                    )}
                  </div>
              </GlassCard>
            </motion.div>
          ))}

          {hasMore && (
            <button
              onClick={() => setDisplayLimit(prev => prev + 10)}
              style={{
                width: '100%', padding: '12px', borderRadius: '12px',
                border: '1px solid #E2E8F0', background: 'white',
                fontWeight: 700, fontSize: '0.85rem', color: '#64748B',
                cursor: 'pointer',
              }}
            >
              Load More Orders
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

export default OrdersPage;
