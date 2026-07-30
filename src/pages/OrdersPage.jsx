import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, ShoppingBag, X } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { api, socket, formatRelativeTime } from '../api';
import { getStoredUser } from '../utils/auth';
import { supabase } from '../supabaseClient';
import './home_v21.css';

const OrdersPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = React.useState([]);

  React.useEffect(() => {
    const userData = getStoredUser() || {};
    const customerId = userData.id || '9876543210';

    async function fetchOrders() {
      try {
        const liveOrders = await api.getStudentOrders(customerId);
        setOrders(liveOrders);
        localStorage.setItem('sgu_orders', JSON.stringify(liveOrders));
      } catch (err) {
        console.error('Failed to fetch student orders:', err);
        // Fallback to localStorage
        const savedOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
        setOrders(savedOrders);
      }
    }

    fetchOrders();

    // Listen to real-time status updates for student's orders
    socket.emit('join', 'student');

    const handleStatusUpdate = (updatedOrder) => {
      const targetId = updatedOrder?.id || updatedOrder?.orderId;
      const nextStatus = updatedOrder?.status;
      if (!targetId || !nextStatus) return;

      setOrders(prev => {
        return prev.map(order => String(order.id) === String(targetId) ? {
          ...order,
          status: nextStatus
        } : order);
      });
    };

    socket.on('order_status_update', handleStatusUpdate);

    // Also subscribe to Supabase broadcast channel for this student
    const studentListCh = supabase.channel(`student_orders_${customerId}`)
      .on('broadcast', { event: 'order_status_update' }, (payload) => {
        const targetId = payload?.payload?.orderId || payload?.orderId || payload?.payload?.id;
        const nextStatus = payload?.payload?.status || payload?.status;
        if (targetId && nextStatus) {
          setOrders(prev => prev.map(o => String(o.id) === String(targetId) ? { ...o, status: nextStatus } : o));
        }
      })
      .subscribe();

    const globalChannel = supabase.channel('global_orders_status')
      .on('broadcast', { event: 'order_status_update' }, (payload) => {
        const targetId = payload?.payload?.orderId || payload?.orderId || payload?.payload?.id;
        const nextStatus = payload?.payload?.status || payload?.status;
        if (targetId && nextStatus) {
          setOrders(prev => prev.map(o => String(o.id) === String(targetId) ? { ...o, status: nextStatus } : o));
        }
      })
      .subscribe();

    // Fast polling fallback (every 2 seconds)
    const interval = setInterval(fetchOrders, 2000);

    return () => {
      socket.off('order_status_update', handleStatusUpdate);
      supabase.removeChannel(studentListCh);
      supabase.removeChannel(globalChannel);
      clearInterval(interval);
    };
  }, []);

  const [displayLimit, setDisplayLimit] = React.useState(10);
  const visibleOrders = orders.slice(0, displayLimit);
  const hasMore = orders.length > displayLimit;

  return (
    <div className="directory-container page-transition">
      <main className="shop-main-content" style={{ paddingTop: '24px' }}>
        <h2 className="heading-2 section-title-home mb-6">My Orders</h2>
        
        <div className="flex flex-col gap-4">
          {orders.length === 0 && (
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
              transition={{ delay: i * 0.1 }}
            >
              <GlassCard 
                className={`tap-effect shadow-sm transition-all ${order.status === 'completed' ? 'opacity-75' : ''}`}
                style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  background: '#FFFFFF',
                  borderLeft: (order.status === 'prep' || order.status === 'preparing') ? '6px solid #E4002B' : 
                              order.status === 'ready' ? '6px solid var(--success-green)' : 
                              order.status === 'pending_cash' ? '6px solid #F59E0B' :
                              order.status === 'placed' ? '6px solid #8B5CF6' :
                              '1px solid #EEEEEE',
                  padding: '16px',
                  borderRadius: '16px'
                }}
                onClick={() => navigate(`/student/order/${order.id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ 
                      fontFamily: 'var(--font-heading)', 
                      fontWeight: 800, 
                      fontSize: '1.15rem', 
                      color: 'var(--text-dark)',
                      letterSpacing: '-0.5px',
                    }}>{order.id}</span>
                    <span style={{ 
                      fontWeight: 700, 
                      fontSize: '0.7rem', 
                      color: 'var(--text-muted)', 
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>{order.timestamp ? formatRelativeTime(order.timestamp).toUpperCase() : (order.time || 'Just now').toUpperCase()}</span>
                  </div>

                  {/* Items */}
                  <p style={{ 
                    fontWeight: 600, 
                    fontSize: '0.85rem', 
                    color: '#64748B',
                    lineHeight: '1.4',
                  }}>
                    {typeof order.items === 'string' 
                      ? order.items 
                      : Array.isArray(order.items) 
                        ? order.items.map(item => `${item.quantity}x ${item.name}`).join(', ') 
                        : ''}
                  </p>

                  {/* Price & Status */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    borderTop: '1px solid #F1F5F9',
                    paddingTop: '8px',
                    marginTop: '2px',
                  }}>
                    <span style={{ 
                      fontFamily: 'var(--font-heading)', 
                      fontWeight: 800, 
                      fontSize: '1.2rem', 
                      color: 'var(--text-dark)' 
                    }}>₹{order.total}</span>
                    
                    {(order.status === 'placed' || order.status === 'pending_cash') && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: order.status === 'pending_cash' ? '#F59E0B' : '#8B5CF6', 
                        color: 'white',
                        fontWeight: 800, fontSize: '0.65rem',
                        padding: '4px 10px', borderRadius: '20px',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        boxShadow: order.status === 'pending_cash' ? '0 2px 8px rgba(245, 158, 11, 0.3)' : '0 2px 8px rgba(139, 92, 246, 0.3)',
                      }}>
                        <Clock size={11} /> {order.status === 'pending_cash' ? 'Awaiting Cash' : 'Order Placed'}
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
                      }}>
                        <Clock size={11} /> Preparing
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
                        <CheckCircle size={11} /> Pick up Now
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
                    {order.status === 'cancelled' && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        background: '#EF4444', color: 'white',
                        fontWeight: 800, fontSize: '0.65rem',
                        padding: '4px 10px', borderRadius: '20px',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                        boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                      }}>
                        <X size={11} strokeWidth={3} /> Cancelled
                      </span>
                    )}
                  </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default OrdersPage;

