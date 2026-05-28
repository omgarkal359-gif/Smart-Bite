import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { ArrowLeft, QrCode, CheckCircle, Clock, ChefHat, BellRing, Download, Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { api, socket } from '../api';
import './pages.css';
import './tracker.css';

const STATUS_STEPS = [
  { id: 'placed', label: 'Order Placed', icon: Clock },
  { id: 'preparing', label: 'Preparing', icon: ChefHat },
  { id: 'ready', label: 'Ready for Pickup', icon: CheckCircle },
];

const DigitalReceiptTracker = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [order, setOrder] = useState(null);

  useEffect(() => {
    async function loadOrder() {
      try {
        const foundOrder = await api.getOrder(orderId);
        setOrder(foundOrder);
        
        // Map status to step index
        if (foundOrder.status === 'placed' || foundOrder.status === 'pending_cash') setCurrentStep(0);
        else if (foundOrder.status === 'preparing') setCurrentStep(1);
        else if (foundOrder.status === 'ready' || foundOrder.status === 'completed') setCurrentStep(2);
      } catch (err) {
        console.error('Failed to load order tracker:', err);
      }
    }

    loadOrder();

    // Listen to real-time socket events for this order status
    socket.emit('join', `order-${orderId}`);

    const handleStatusUpdate = (updatedOrder) => {
      setOrder(updatedOrder);
      if (updatedOrder.status === 'placed' || updatedOrder.status === 'pending_cash') setCurrentStep(0);
      else if (updatedOrder.status === 'preparing') setCurrentStep(1);
      else if (updatedOrder.status === 'ready' || updatedOrder.status === 'completed') setCurrentStep(2);
    };

    socket.on('order_status_update', handleStatusUpdate);

    return () => {
      socket.off('order_status_update', handleStatusUpdate);
    };
  }, [orderId]);

  const itemsText = useMemo(() => {
    if (!order) return '';
    if (typeof order.items === 'string') return order.items;
    if (Array.isArray(order.items)) {
      return order.items.map(item => `${item.quantity}x ${item.name}`).join(', ');
    }
    return '';
  }, [order]);

  return (
    <div className="tracker-container-v21 page-transition">
      <header className="glass-header blur-header">
        <div className="menu-header-top">
          <button className="btn-icon tap-effect" onClick={() => navigate('/student')}>
            <ArrowLeft size={24} />
          </button>
          <h1 className="heading-2">Order #{orderId}</h1>
          <div style={{ width: 40 }} />
        </div>
      </header>

      <main className="tracker-main-v21">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
        >
          <GlassCard className="receipt-card-v21 shadow-md">
            
            <div className="qr-section-v21">
              <div className="qr-wrapper-v21">
                <QrCode size={120} color="var(--primary-navy)" />
              </div>
              <p className="heading-2 mt-4">#{orderId}</p>
              <p className="text-muted">Show code at the counter</p>
              {order && (
                <div className="order-summary-v21 mt-4 p-4 border-t border-dashed w-full text-left">
                  <p className="font-bold text-sm mb-2">{itemsText}</p>
                  <p className="font-black text-lg">Total: ₹{order.total}</p>
                </div>
              )}
            </div>

            <div className="timeline-v21">
              {STATUS_STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = index <= currentStep;
                const isCurrent = index === currentStep;

                return (
                  <div key={step.id} className={`timeline-step-v21 ${isActive ? 'active' : ''}`}>
                    <div className={`step-icon-v21 ${isCurrent && index === 2 ? 'pulse-ready' : ''}`}>
                      <Icon size={20} />
                    </div>
                    <div className="step-content-v21">
                      <h3 className="step-label">{step.label}</h3>
                      {isCurrent && <p className="step-desc text-muted">In progress...</p>}
                    </div>
                    {index < STATUS_STEPS.length - 1 && <div className="step-line-v21" />}
                  </div>
                );
              })}
            </div>

            {currentStep === 2 && (
              <motion.div 
                className="ready-actions-v21 mt-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <button className="btn-pdf-v21">
                  <Download size={20} /> Download PDF Receipt
                </button>
                <button className="btn-email-v21">
                  <Mail size={20} /> Resend to Email
                </button>
              </motion.div>
            )}
          </GlassCard>
        </motion.div>
      </main>
    </div>
  );
};

export default DigitalReceiptTracker;
