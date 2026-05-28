import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, ShoppingBag } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import { api, socket } from '../api';
import './home_v21.css';

const OrdersPage = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = React.useState([]);

  React.useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('sgu_user') || '{}');
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
      setOrders(prev => {
        // Only update if the order belongs to this customer
        if (updatedOrder.customerId !== customerId) return prev;
        
        // If order is updated, replace it in the list
        if (!prev.some(order => order.id === updatedOrder.id)) {
          return [updatedOrder, ...prev];
        }
        return prev.map(order => order.id === updatedOrder.id ? {
          ...order,
          status: updatedOrder.status
        } : order);
      });
    };

    socket.on('order_status_update', handleStatusUpdate);

    return () => {
      socket.off('order_status_update', handleStatusUpdate);
    };
  }, []);

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
          {orders.map((order, i) => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
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
                  gap: '16px',
                }}
                onClick={() => navigate(`/student/order/${order.id}`)}
              >
                <div className="shop-img-container shadow-sm" style={{ width: '90px', height: '90px', flexShrink: 0, borderRadius: '12px' }}>
                  <img src={order.img || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'} alt="Order" className="shop-hd-img" style={{ borderRadius: '10px' }} />
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
                  {/* Order ID & Time */}
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
                    }}>{order.time}</span>
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
                  </div>
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

