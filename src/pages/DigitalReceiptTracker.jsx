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
  const [toastMsg, setToastMsg] = useState('');

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

  const handleResend = async () => {
    if (!order) return;
    try {
      await api.resendReceipt(orderId);
      const isEmail = order.customerId?.includes('@');
      const method = isEmail ? 'Email' : 'SMS';
      setToastMsg(`Digital receipt successfully resent to ${order.customerId} via ${method}!`);
    } catch (err) {
      console.error('Failed to resend receipt:', err);
      setToastMsg('Failed to resend receipt. Please try again.');
    }
    setTimeout(() => {
      setToastMsg('');
    }, 4000);
  };

  const handleDownloadPDF = () => {
    if (!order) return;
    const isEmail = order.customerId?.includes('@');
    const dispatchMethod = isEmail ? 'EMAIL' : 'MOBILE SMS';
    
    let itemsTextRaw = '';
    if (typeof order.items === 'string') {
      itemsTextRaw = order.items;
    } else if (Array.isArray(order.items)) {
      itemsTextRaw = order.items.map(item => `   - ${item.quantity}x ${item.name} (₹${item.price} each)`).join('\n');
    }
    
    const invoiceContent = `==================================================
                  SGU FOOD COURT
                DIGITAL INVOICE & RECEIPT
==================================================
Order ID       : ${order.id}
Customer Name  : ${order.customerName}
Contact Info   : ${order.customerId} (${dispatchMethod})
Payment Method : ${order.payment}
Order Status   : ${order.status.toUpperCase()}
Date & Time    : ${order.timestamp || new Date().toISOString()}

--------------------------------------------------
ITEMS ORDERED:
${itemsTextRaw}
--------------------------------------------------
GRAND TOTAL    : ₹${order.total}

Thank you for dining with us!
==================================================
`;
    const blob = new Blob([invoiceContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SGU_Receipt_${order.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setToastMsg(`Receipt invoice downloaded successfully!`);
    setTimeout(() => {
      setToastMsg('');
    }, 4000);
  };

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

      {/* Premium Resend Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            style={{
              position: 'fixed',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: 'rgba(26, 82, 118, 0.95)',
              backdropFilter: 'blur(10px)',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '24px',
              boxShadow: '0 10px 25px rgba(26, 82, 118, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              fontSize: '0.85rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              pointerEvents: 'none'
            }}
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="tracker-main-v21">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 15 }}
        >
          <GlassCard className="receipt-card-v21 shadow-md">
            
            {/* Dynamic Digital Receipt Sent! Premium Notification Banner */}
            {order && (
              <div style={{
                background: 'rgba(26, 82, 118, 0.08)',
                border: '1px solid rgba(26, 82, 118, 0.15)',
                borderRadius: '16px',
                padding: '12px 16px',
                marginBottom: '24px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                textAlign: 'left',
                width: '100%'
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'var(--primary-navy)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {order.customerId?.includes('@') ? <Mail size={18} /> : <BellRing size={18} />}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-navy)' }}>
                    Digital Receipt Sent!
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {order.customerId?.includes('@') 
                      ? `Emailed to: ${order.customerId}` 
                      : `Sent via SMS to: ${order.customerId}`}
                  </span>
                </div>
              </div>
            )}

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

            {order && (
              <motion.div 
                className="ready-actions-v21 mt-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <button className="btn-pdf-v21" onClick={handleDownloadPDF} style={{ cursor: 'pointer' }}>
                  <Download size={20} /> Download Invoice
                </button>
                <button className="btn-email-v21" onClick={handleResend} style={{ cursor: 'pointer' }}>
                  {order.customerId?.includes('@') ? (
                    <>
                      <Mail size={20} /> Resend to Email
                    </>
                  ) : (
                    <>
                      <BellRing size={20} /> Resend via SMS
                    </>
                  )}
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
