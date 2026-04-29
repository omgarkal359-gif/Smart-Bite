import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, CheckCircle } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';
import './home_v21.css';

const MOCK_ORDERS = [
  { id: 'SGU-ULTIMATE', status: 'prep', total: 340, items: '2x Margherita Pizza, 1x Coke', time: 'Just now', img: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=300&q=80&fm=webp' },
  { id: 'SGU-002', status: 'ready', total: 160, items: '1x Classic Burger', time: '1 hour ago', img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80&fm=webp' },
  { id: 'SGU-001', status: 'completed', total: 250, items: '1x BBQ Chicken Pizza', time: 'Yesterday', img: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=300&q=80&fm=webp' }
];

const OrdersPage = () => {
  const navigate = useNavigate();

  return (
    <div className="directory-container page-transition">
      <main className="shop-main-content" style={{ paddingTop: '24px' }}>
        <h2 className="heading-2 section-title-home mb-6">My Orders</h2>
        
        <div className="flex flex-col gap-4">
          {MOCK_ORDERS.map((order, i) => (
            <motion.div 
              key={order.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <GlassCard 
                className={`shop-card-v21 tap-effect shadow-sm transition-all ${order.status === 'completed' ? 'opacity-75' : ''}`}
                style={{ 
                  borderLeft: order.status === 'prep' ? '6px solid #E4002B' : order.status === 'ready' ? '6px solid var(--success-green)' : '1px solid #EEEEEE' 
                }}
                onClick={() => navigate(`/student/order/${order.id}`)}
              >
                <div className="shop-img-container shadow-sm" style={{ width: '100px', flexShrink: 0 }}>
                  <img src={order.img} alt="Order" className="shop-hd-img" />
                </div>

                <div className="shop-card-right flex flex-col justify-between" style={{ padding: '12px' }}>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-heading font-black text-xl tracking-tight" style={{ color: 'var(--text-dark)' }}>{order.id}</span>
                      <span className="font-bold text-gray-500 text-xs tracking-wider uppercase">{order.time}</span>
                    </div>
                    <p className="font-bold text-gray-700 text-sm">{order.items}</p>
                  </div>
                  
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                    <span className="font-heading font-black text-xl" style={{ color: 'var(--text-dark)' }}>₹{order.total}</span>
                    
                    {order.status === 'prep' && (
                      <span className="flex items-center gap-1 text-white font-extrabold text-xs bg-[#E4002B] px-2 py-1 rounded-full shadow-sm uppercase tracking-wide">
                        <Clock size={12} /> Preparing
                      </span>
                    )}
                    {order.status === 'ready' && (
                      <span className="flex items-center gap-1 text-white font-extrabold text-xs bg-[#22C55E] px-2 py-1 rounded-full shadow-sm uppercase tracking-wide">
                        <CheckCircle size={12} /> Pick up Now
                      </span>
                    )}
                    {order.status === 'completed' && (
                      <span className="flex items-center gap-1 text-gray-600 font-extrabold text-xs bg-gray-100 px-2 py-1 rounded-full uppercase tracking-wide">
                        <CheckCircle size={12} /> Completed
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
