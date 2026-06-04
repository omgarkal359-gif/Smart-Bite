import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { ArrowLeft, QrCode, CheckCircle, Clock, ChefHat, BellRing, Download, Mail, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [emailInput, setEmailInput] = useState('');

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

    // Polling fallback
    const interval = setInterval(loadOrder, 7000); // Poll every 7 seconds

    return () => {
      socket.off('order_status_update', handleStatusUpdate);
      clearInterval(interval);
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

  const handleSendCustomEmail = async () => {
    if (!emailInput) {
      setToastMsg('Please enter a valid email address.');
      setTimeout(() => setToastMsg(''), 3000);
      return;
    }
    if (!emailInput.includes('@')) {
      setToastMsg('Please type a valid email containing @.');
      setTimeout(() => setToastMsg(''), 3000);
      return;
    }

    try {
      await api.resendReceipt(orderId, emailInput);
      setToastMsg(`Digital receipt successfully sent to ${emailInput}!`);
      setEmailInput('');
    } catch (err) {
      console.error('Failed to send receipt:', err);
      setToastMsg('Failed to send receipt. Please try again.');
    }
    setTimeout(() => {
      setToastMsg('');
    }, 4000);
  };

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
    
    const shopName = order.items?.[0]?.stallName || 'SGU Food Court';
    const dateTimeString = order.timestamp ? new Date(order.timestamp).toLocaleString() : new Date().toLocaleString();
    
    let itemsHtmlRows = '';
    if (typeof order.items === 'string') {
      itemsHtmlRows = `<div class="item-row"><span class="item-name">${order.items}</span></div>`;
    } else if (Array.isArray(order.items)) {
      itemsHtmlRows = order.items.map(item => `
        <div class="item-row">
          <span class="item-name">${item.quantity}x ${item.name}</span>
          <div class="item-details">
            <span class="item-price">₹${item.price} each</span>
            <span class="item-total">₹${item.price * item.quantity}</span>
          </div>
        </div>
      `).join('');
    }
    
    const invoiceContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>SGU SmartBite Ticket - #${order.id}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&family=Oswald:wght@500;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background-color: #F1F5F9;
      margin: 0;
      padding: 20px 10px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .ticket-container {
      width: 100%;
      max-width: 360px;
      background-color: #FFFFFF;
      border-radius: 24px;
      box-shadow: 0 15px 35px rgba(228, 0, 43, 0.15);
      border: 3px solid #E4002B;
      overflow: hidden;
      box-sizing: border-box;
      position: relative;
    }
    .ticket-header {
      background: linear-gradient(135deg, #E4002B 0%, #B00020 100%);
      color: #FFFFFF;
      padding: 24px 20px;
      text-align: center;
      position: relative;
    }
    .ticket-header h1 {
      margin: 0;
      font-family: 'Oswald', sans-serif;
      font-size: 1.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }
    .ticket-header p {
      margin: 4px 0 0 0;
      font-size: 0.85rem;
      opacity: 0.95;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .ticket-body {
      padding: 24px 20px;
      color: #111827;
    }
    .shop-section {
      text-align: center;
      margin-bottom: 20px;
    }
    .shop-title {
      font-family: 'Oswald', sans-serif;
      font-size: 1.4rem;
      font-weight: 700;
      color: #E4002B;
      text-transform: uppercase;
      margin: 0 0 4px 0;
    }
    .order-tag {
      display: inline-block;
      background: rgba(228, 0, 43, 0.1);
      color: #E4002B;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      font-size: 0.8rem;
      margin-top: 20px;
      margin-bottom: 20px;
      padding: 12px;
      background-color: #FFF5F5;
      border-radius: 14px;
      border: 1px solid rgba(228, 0, 43, 0.1);
    }
    .info-item {
      display: flex;
      flex-direction: column;
      text-align: left;
    }
    .info-item span:first-child {
      color: #6B7280;
      display: block;
      margin-bottom: 2px;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.7rem;
    }
    .info-item span:last-child {
      font-weight: 700;
      color: #111827;
    }
    
    /* Creative Ticket Separator with side circle notches */
    .ticket-separator {
      height: 20px;
      position: relative;
      background: transparent;
      margin: 20px -23px; /* extends slightly beyond padding */
    }
    .ticket-separator::before, .ticket-separator::after {
      content: '';
      position: absolute;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #F1F5F9; /* matches body background */
      top: -12px;
      border: 3px solid #E4002B;
      box-sizing: border-box;
      z-index: 10;
    }
    .ticket-separator::before {
      left: 10px;
    }
    .ticket-separator::after {
      right: 10px;
    }
    .separator-line {
      border: none;
      border-top: 2px dashed #E4002B;
      position: absolute;
      left: 30px;
      right: 30px;
      top: 0;
      height: 1px;
    }
    
    .items-title {
      font-family: 'Oswald', sans-serif;
      font-size: 0.95rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #374151;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
      text-align: left;
    }
    
    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #F3F4F6;
    }
    .item-row:last-of-type {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .item-name {
      font-weight: 700;
      color: #111827;
    }
    .item-details {
      text-align: right;
    }
    .item-price {
      font-size: 0.75rem;
      color: #6B7280;
      margin-right: 8px;
      font-weight: 500;
    }
    .item-total {
      font-weight: 700;
      color: #111827;
    }
    
    .total-section {
      background: #E4002B;
      color: #FFFFFF;
      border-radius: 14px;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 20px;
      box-shadow: 0 4px 10px rgba(228, 0, 43, 0.2);
    }
    .total-label {
      font-family: 'Oswald', sans-serif;
      font-size: 1.1rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .total-value {
      font-size: 1.6rem;
      font-weight: 900;
    }
    
    /* Creative Barcode Simulation */
    .barcode-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px dashed #E5E7EB;
    }
    .barcode {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 2.5px;
      height: 44px;
      width: 100%;
      margin-bottom: 6px;
    }
    .bar {
      height: 100%;
      background-color: #111827;
      width: 2px;
      border-radius: 1px;
    }
    .bar.thick { width: 4.5px; }
    .bar.thin { width: 1px; }
    .bar.medium { width: 3px; }
    
    .barcode-number {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.75rem;
      color: #6B7280;
      font-weight: 600;
      letter-spacing: 2px;
    }
    
    .ticket-footer {
      text-align: center;
      font-size: 0.75rem;
      color: #9CA3AF;
      margin-top: 24px;
      font-weight: 600;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="ticket-container">
    <div class="ticket-header">
      <h1>SGU SmartBite</h1>
      <p>Official Digital Receipt</p>
    </div>
    
    <div class="ticket-body">
      <div class="shop-section">
        <h2 class="shop-title">${shopName}</h2>
        <div class="order-tag">Order #${order.id}</div>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <span>Date & Time</span>
          <span>${dateTimeString}</span>
        </div>
        <div class="info-item">
          <span>Customer</span>
          <span>${order.customerName}</span>
        </div>
        <div class="info-item">
          <span>Payment Mode</span>
          <span>${order.payment}</span>
        </div>
        <div class="info-item">
          <span>Order Status</span>
          <span style="color: #22C55E; text-transform: uppercase;">${order.status}</span>
        </div>
      </div>
      
      <div class="ticket-separator">
        <div class="separator-line"></div>
      </div>
      
      <div class="items-title">Items Ordered</div>
      <div class="items-list">
        ${itemsHtmlRows}
      </div>
      
      <div class="total-section">
        <span class="total-label">Grand Total</span>
        <span class="total-value">₹${order.total}</span>
      </div>
      
      <div class="barcode-section">
        <div class="barcode">
          <div class="bar thin"></div><div class="bar thick"></div><div class="bar medium"></div>
          <div class="bar thin"></div><div class="bar medium"></div><div class="bar thick"></div>
          <div class="bar thin"></div><div class="bar thick"></div><div class="bar thin"></div>
          <div class="bar medium"></div><div class="bar thin"></div><div class="bar thick"></div>
          <div class="bar medium"></div><div class="bar thin"></div><div class="bar thick"></div>
          <div class="bar thin"></div><div class="bar medium"></div><div class="bar thick"></div>
          <div class="bar thin"></div><div class="bar medium"></div><div class="bar thin"></div>
          <div class="bar thick"></div><div class="bar thin"></div><div class="bar thick"></div>
          <div class="bar medium"></div><div class="bar thin"></div><div class="bar medium"></div>
        </div>
        <div class="barcode-number">${order.id}-${Math.floor(100000 + Math.random() * 900000)}</div>
      </div>
      
      <div class="ticket-footer">
        Thank you for dining with us!<br>
        Show this ticket at the counter to collect your order.
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([invoiceContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `SGU_Receipt_${order.id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setToastMsg(`Receipt downloaded successfully!`);
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
              {order && (
                <p className="shop-name-tracker">
                  {order.items?.[0]?.stallName || 'SGU Food Court'}
                </p>
              )}
              <p className="text-muted mt-1">Show code at the counter</p>
            </div>

            {order && (
              <div className="order-summary-v21">
                <p className="font-bold text-sm mb-2">{itemsText}</p>
                <p className="font-black text-lg">Total: ₹{order.total}</p>
              </div>
            )}

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
              <>
                <motion.div 
                  className="ready-actions-v21 mt-6"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <button 
                    className="btn-pdf-v21" 
                    onClick={() => {
                      const itemsList = order.items || [];
                      const firstItem = itemsList[0] || {};
                      const stallId = firstItem.stallId || firstItem.stallid || '';
                      if (stallId) {
                        navigate(`/student/shop/${stallId}`);
                      } else {
                        navigate('/student');
                      }
                    }} 
                    style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #1A5276, #2471A3)', boxShadow: '0 4px 14px rgba(26,82,118,0.3)' }}
                  >
                    <ShoppingBag size={20} /> Order More
                  </button>
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

                {/* Custom Email Dispatch Form */}
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="email-receipt-section"
                >
                  <h4 className="email-receipt-title">
                    Send Receipt to Email
                  </h4>
                  <div className="email-input-wrapper">
                    <input 
                      type="email" 
                      placeholder="Enter your email address" 
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="email-input-field"
                    />
                    <button 
                      onClick={handleSendCustomEmail}
                      className="btn-send-email tap-effect"
                    >
                      <Mail size={16} /> Send
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </GlassCard>
        </motion.div>
      </main>
    </div>
  );
};

export default DigitalReceiptTracker;
