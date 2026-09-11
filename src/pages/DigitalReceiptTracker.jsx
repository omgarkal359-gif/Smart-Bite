import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { ArrowLeft, QrCode, CheckCircle, Clock, ChefHat, BellRing, Download, ShoppingBag, ShieldAlert, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, socket } from '../api';
import { supabase } from '../supabaseClient';
import { getStoredUser } from '../utils/auth';
import './pages.css';
import './tracker.css';

const STATUS_STEPS = [
  { id: 'placed', label: 'ORDER PLACED', icon: Clock, desc: 'Order received by kitchen' },
  { id: 'preparing', label: 'PREPARING', icon: ChefHat, desc: 'Preparing your order...' },
  { id: 'ready', label: 'READY FOR PICKUP', icon: CheckCircle, desc: 'Your order is ready at the counter!' },
];

const DigitalReceiptTracker = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [order, setOrder] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [toastMsg, setToastMsg] = useState('');
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  useEffect(() => {
    async function loadOrder() {
      try {
        const savedUser = getStoredUser() || {};
        const currentUserId = (savedUser.username || savedUser.id || '').trim().toLowerCase();
        const currentUserRole = (savedUser.role || 'student').trim().toLowerCase();

        let foundOrder = await api.getOrder(orderId);
        
        // Security Ownership Guard: Prevent viewing other students' orders by changing order link ID
        const orderOwner = (foundOrder?.customerId || foundOrder?.customerid || '').trim().toLowerCase();
        if ((currentUserRole === 'student' || currentUserRole === 'guest') && currentUserId && orderOwner && orderOwner !== currentUserId) {
          setIsAccessDenied(true);
          setOrder(null);
          return;
        }

        // Enrich items from localStorage if API didn't return them
        try {
          const savedOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
          const localMatch = Array.isArray(savedOrders) ? savedOrders.find(o =>
            String(o.id) === String(orderId) ||
            String(o.orderId) === String(orderId) ||
            String(o.orderNumber) === String(orderId) ||
            String(o.order_number) === String(orderId)
          ) : null;
          if (!foundOrder && localMatch) {
            foundOrder = localMatch;
          } else if (foundOrder && localMatch) {
            if ((!foundOrder.items || foundOrder.items.length === 0) && localMatch.items && localMatch.items.length > 0) {
              foundOrder.items = localMatch.items;
            }
          }
          // If still no items, try reading cart backup
          if (foundOrder && (!foundOrder.items || foundOrder.items.length === 0)) {
            const cartBackup = JSON.parse(localStorage.getItem(`sgu_cart_backup_${orderId}`) || 'null');
            if (cartBackup && Array.isArray(cartBackup) && cartBackup.length > 0) {
              foundOrder.items = cartBackup;
            }
          }
        } catch (_e) {}

        if (foundOrder) {
          // Use functional updater to preserve items already loaded from a previous cycle
          setOrder(prev => {
            const merged = { ...foundOrder };
            if (prev && prev.items && prev.items.length > 0 && (!merged.items || merged.items.length === 0)) {
              merged.items = prev.items;
            }
            return merged;
          });
          setIsAccessDenied(false);

          // Fetch vendor (name + FSSAI) for the receipt.
          const stallId = foundOrder.stallId || foundOrder.items?.[0]?.stallId;
          if (stallId) {
            api.getVendorByStall(stallId).then(v => { if (v) setVendor(v); }).catch(() => {});
          }

          if (foundOrder.status) {
            applyNewStatus(foundOrder.status);
          }

          // Ensure receipt is persisted to Supabase 'receipts' table
          api.saveReceipt(foundOrder).catch(() => {});
        }
      } catch (err) {
        console.error('Failed to load order tracker:', err);
        if (err.message?.toLowerCase().includes('denied') || err.message?.includes('403')) {
          setIsAccessDenied(true);
        }
      }
    }

    loadOrder();

    const applyNewStatus = (newStatus) => {
      if (!newStatus) return;
      const lower = String(newStatus).trim().toLowerCase();
      if (lower === 'placed' || lower === 'pending' || lower === 'pending_cash') setCurrentStep(0);
      else if (lower === 'preparing') setCurrentStep(1);
      else if (lower === 'ready' || lower === 'completed') setCurrentStep(2);

      setOrder(prev => {
        const updated = prev ? { ...prev, status: newStatus } : { id: orderId, status: newStatus };
        if (prev?.items && (!updated.items || updated.items.length === 0)) {
          updated.items = prev.items;
        }
        
        try {
          const savedOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
          const newOrdersList = savedOrders.map(o => String(o.id) === String(orderId) ? { ...o, status: newStatus } : o);
          localStorage.setItem('sgu_orders', JSON.stringify(newOrdersList));
        } catch (_err) {
          // localStorage parse or quota error ignored safely
        }

        return updated;
      });
    };

    // Listen to real-time socket events for this order status
    socket.emit('join', `order-${orderId}`);

    const handleSocketUpdate = (data) => {
      const targetId = data?.id || data?.orderId;
      if (targetId && String(targetId) === String(orderId) && data.status) {
        applyNewStatus(data.status);
      }
    };

    socket.on('order_status_update', handleSocketUpdate);

    // Setup Supabase Realtime Broadcast & Postgres Database Listener
    const channel = supabase.channel(`student_sync_${orderId}`)
      .on('broadcast', { event: 'order_status_update' }, (payload) => {
        const status = payload?.payload?.status || payload?.status;
        if (status) applyNewStatus(status);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
        if (payload?.new?.status) applyNewStatus(payload.new.status);
      })
      .subscribe();

    const globalChannel = supabase.channel('global-orders-broadcast')
      .on('broadcast', { event: 'order_status_update' }, (payload) => {
        const data = payload?.payload || payload;
        const targetId = data?.orderId || data?.id;
        const status = data?.status;
        if (targetId && String(targetId) === String(orderId) && status) {
          applyNewStatus(status);
        }
      })
      .subscribe();

    // Fast polling fallback (every 2 seconds)
    const interval = setInterval(loadOrder, 2000);

    return () => {
      socket.off('order_status_update', handleSocketUpdate);
      supabase.removeChannel(channel);
      supabase.removeChannel(globalChannel);
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

  const orderItemsList = useMemo(() => {
    if (!order) return [];
    let items = order.items;

    // If missing or empty on order object, try reading from localStorage
    if (!items || (Array.isArray(items) && items.length === 0)) {
      try {
        const savedOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
        const local = Array.isArray(savedOrders) ? savedOrders.find(o => String(o.id) === String(orderId || order.id)) : null;
        if (local && local.items) {
          items = local.items;
        }
      } catch (_e) {}
    }

    if (typeof items === 'string') {
      try {
        const parsed = JSON.parse(items);
        if (Array.isArray(parsed)) items = parsed;
        else items = items.split(',').map(s => {
          const match = s.trim().match(/^(\d+)x?\s*(.+)$/i);
          return match ? { quantity: Number(match[1]), name: match[2].trim() } : { quantity: 1, name: s.trim() };
        });
      } catch (_e) {
        items = items.split(',').map(s => {
          const match = s.trim().match(/^(\d+)x?\s*(.+)$/i);
          return match ? { quantity: Number(match[1]), name: match[2].trim() } : { quantity: 1, name: s.trim() };
        });
      }
    }

    if (Array.isArray(items) && items.length > 0) {
      return items.map(it => ({
        name: it.name || it.itemName || it.title || 'Food Item',
        quantity: Number(it.quantity || it.qty) || 1,
        price: it.price != null ? Number(it.price) : null
      }));
    }

    // Fallback: If no items breakdown exists but order has a total, provide a clear order line
    if (order.total) {
      return [{
        name: 'Ordered Items',
        quantity: 1,
        price: Number(order.total)
      }];
    }

    return [];
  }, [order, orderId, vendor]);

  const handleDownloadPDF = async () => {
    if (!order) return;
    
    const shopName = vendor?.name || order.items?.[0]?.stallName || 'SGU Food Court';
    const fssai = vendor?.fssai || '—';
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
          <span>Vendor</span>
          <span>${shopName}</span>
        </div>
        <div class="info-item">
          <span>FSSAI Lic. No.</span>
          <span>${fssai}</span>
        </div>
        <div class="info-item">
          <span>Date & Time</span>
          <span>${dateTimeString}</span>
        </div>
        <div class="info-item">
          <span>Customer</span>
          <span>${order.customerName || '—'}</span>
        </div>
        <div class="info-item">
          <span>Payment Mode</span>
          <span>${order.payment || '—'}</span>
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

    // Render the receipt HTML in an offscreen iframe, snapshot the ticket with
    // html2canvas, then place it into a PDF sized to the ticket and download.
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:420px;height:10px;border:0;';
    document.body.appendChild(iframe);

    try {
      let jsPDFModule = null;
      let html2canvasModule = null;
      const pdfPkg = 'jspdf';
      const canvasPkg = 'html2canvas';
      try {
        jsPDFModule = await import(/* @vite-ignore */ pdfPkg).then(m => m.jsPDF || m.default).catch(() => null);
        html2canvasModule = await import(/* @vite-ignore */ canvasPkg).then(m => m.default || m).catch(() => null);
      } catch (_e) {}

      if (!jsPDFModule || !html2canvasModule) {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(invoiceContent);
          win.document.close();
          win.focus();
          win.print();
        } else {
          setToastMsg('PDF generation unavailable. Please use browser print.');
        }
        return;
      }

      const jsPDF = jsPDFModule;
      const html2canvas = html2canvasModule;

      const doc = iframe.contentDocument;
      doc.open();
      doc.write(invoiceContent);
      doc.close();

      // Wait for the iframe document + web fonts to be ready.
      await new Promise((resolve) => {
        if (doc.readyState === 'complete') resolve();
        else iframe.onload = () => resolve();
      });
      try { await doc.fonts?.ready; } catch (_e) {}
      await new Promise((r) => setTimeout(r, 150));

      const ticket = doc.querySelector('.ticket-container') || doc.body;
      const canvas = await html2canvas(ticket, {
        scale: 2,
        backgroundColor: '#FFFFFF',
        useCORS: true,
        windowWidth: ticket.scrollWidth,
        windowHeight: ticket.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`SGU_Receipt_${order.id}.pdf`);

      setToastMsg('Receipt downloaded successfully!');
    } catch (err) {
      console.error('PDF generation failed:', err);
      setToastMsg('Could not generate PDF. Please try again.');
    } finally {
      document.body.removeChild(iframe);
      setTimeout(() => setToastMsg(''), 4000);
    }
  };

  if (isAccessDenied) {
    return (
      <div className="tracker-container-v21 page-transition">
        <header className="glass-header blur-header">
          <div className="menu-header-top">
            <button className="btn-icon tap-effect" onClick={() => navigate('/student/orders')}>
              <ArrowLeft size={24} />
            </button>
            <h1 className="heading-2">Access Denied</h1>
            <div style={{ width: 40 }} />
          </div>
        </header>

        <main className="tracker-main-v21 flex flex-col items-center justify-center p-6 text-center" style={{ minHeight: '60vh' }}>
          <GlassCard style={{ padding: '36px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', borderTop: '5px solid #FF3B5C', maxWidth: 420, width: '100%' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: '#FFF1F2', color: '#FF3B5C', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <ShieldAlert size={36} />
            </div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-dark)', margin: '0 0 8px 0' }}>
              UNAUTHORIZED ORDER LINK
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 20px 0', fontWeight: 500 }}>
              Security Policy Alert: You are not authorized to view or access another student&apos;s order details by modifying the order number in the link.
            </p>
            <button 
              onClick={() => navigate('/student/orders')}
              style={{
                width: '100%', padding: '12px 20px', borderRadius: 999, border: 'none',
                background: 'linear-gradient(135deg, #FF3B5C, #E11D48)', color: 'white',
                fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: '0.9rem',
                cursor: 'pointer', boxShadow: '0 4px 14px rgba(255, 59, 92, 0.35)'
              }}
            >
              RETURN TO MY ORDERS
            </button>
          </GlassCard>
        </main>
      </div>
    );
  }

  return (
    <div className="tracker-container-v21 page-transition">
      <header className="glass-header blur-header">
        <div className="menu-header-top">
          <button className="btn-icon tap-effect" aria-label="Return to Student Home" onClick={() => navigate('/student')}>
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
            role="status"
            aria-live="polite"
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
          {order?.status === 'cancelled' ? (
            <GlassCard className="receipt-card-v21 shadow-md" style={{ maxWidth: 480, margin: '0 auto' }}>
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', background: '#FEE2E2', padding: '24px', borderRadius: '50%', marginBottom: '24px', boxShadow: '0 10px 25px rgba(239, 68, 68, 0.2)' }}>
                  <XCircle size={64} color="#EF4444" strokeWidth={2.5} />
                </div>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', color: '#EF4444', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Order Cancelled</h2>
                <p style={{ color: '#64748B', fontSize: '0.95rem', fontWeight: 600, marginBottom: '24px' }}>
                  This order has been permanently cancelled by the vendor.
                </p>
                <div className="order-summary-v21" style={{ opacity: 0.8 }}>
                  <div className="receipt-items-list">
                    {orderItemsList.map((item, idx) => (
                      <div key={idx} className="receipt-item-row">
                        <div className="receipt-item-left">
                          <span className="receipt-item-qty">{item.quantity}x</span>
                          <span className="receipt-item-name" style={{ textDecoration: 'line-through' }}>{item.name}</span>
                        </div>
                        <span className="receipt-item-price" style={{ textDecoration: 'line-through' }}>
                          {item.price != null ? `₹${(Number(item.price) || 0) * (item.quantity || 1)}` : `₹${order.total}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="receipt-divider-dashed" />
                  <p className="font-black text-lg m-0" style={{ color: '#94A3B8' }}>Total: ₹{order.total}</p>
                </div>
              </div>
            </GlassCard>
          ) : (
            <div className="tracker-cards-grid-v21">

              {/* ── LEFT: QR + payment + items ── */}
              <GlassCard className="receipt-card-v21 shadow-md">
                <div className="qr-section-v21">
                  <div className="qr-wrapper-v21">
                    <QrCode size={120} color="var(--primary-navy)" />
                  </div>
                  <p className="heading-2 mt-4">#{orderId}</p>
                  <p className="shop-name-tracker">
                    {vendor?.name || order?.items?.[0]?.stallName || 'SGU Food Court'}
                  </p>
                  {vendor?.fssai && (
                    <p className="text-muted" style={{ fontSize: '0.72rem', marginTop: 2 }}>FSSAI Lic. {vendor.fssai}</p>
                  )}
                  <p className="text-muted mt-1">Show code at the counter</p>
                </div>

                {order && (
                  <div className="order-summary-v21">
                    <div className="receipt-items-list">
                      {orderItemsList.map((item, idx) => (
                        <div key={idx} className="receipt-item-row">
                          <div className="receipt-item-left">
                            <span className="receipt-item-qty">{item.quantity}x</span>
                            <span className="receipt-item-name">{item.name}</span>
                          </div>
                          <span className="receipt-item-price">
                            {item.price != null ? `₹${(Number(item.price) || 0) * (item.quantity || 1)}` : `₹${order.total}`}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="receipt-divider-dashed" />

                    <div className="receipt-total-row">
                      <p className="font-black text-lg m-0">Total: ₹{order.total}</p>
                    </div>
                  </div>
                )}

                {order && (
                  <div style={{ marginTop: 16, width: '100%', boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, textAlign: 'left', background: '#FFF5F5', border: '1px solid rgba(228,0,43,0.08)', borderRadius: 14, padding: 14 }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.66rem' }}>Payment ID</div>
                      <div style={{ fontWeight: 700, wordBreak: 'break-all', fontSize: '0.8rem' }}>{order.id}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.66rem' }}>Method</div>
                      <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{order.payment || '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.66rem' }}>Payment</div>
                      <div style={{ fontWeight: 800, fontSize: '0.8rem', color: order.paymentStatus === 'paid' ? '#059669' : '#b45309' }}>{(order.paymentStatus || 'pending').toUpperCase()}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.66rem' }}>Date &amp; Time</div>
                      <div style={{ fontWeight: 700, fontSize: '0.78rem' }}>{order.timestamp ? new Date(order.timestamp).toLocaleString() : '—'}</div>
                    </div>
                  </div>
                )}
              </GlassCard>

              {/* ── RIGHT: order status + actions ── */}
              <GlassCard className="receipt-card-v21 shadow-md">
                <h3 style={{ fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 18px', color: 'var(--text-dark)', textAlign: 'center', width: '100%' }}>Order Status</h3>

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
                          {isCurrent && <p className="step-desc text-muted">{step.desc}</p>}
                        </div>
                        {index < STATUS_STEPS.length - 1 && <div className="step-line-v21" />}
                      </div>
                    );
                  })}
                </div>

                {order && (
                  <>
                    <motion.div className="ready-actions-v21" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                      <button
                        className="btn-pdf-v21"
                        onClick={() => {
                          const stallId = order.items?.[0]?.stallId || order.stallId || '';
                          navigate(stallId ? `/student/shop/${stallId}` : '/student');
                        }}
                        style={{ cursor: 'pointer', background: 'linear-gradient(135deg, #1A5276, #2471A3)', boxShadow: '0 4px 14px rgba(26,82,118,0.3)' }}
                      >
                        <ShoppingBag size={20} /> Order More
                      </button>
                      <button className="btn-pdf-v21" onClick={handleDownloadPDF} style={{ cursor: 'pointer' }}>
                        <Download size={20} /> Download Receipt
                      </button>
                    </motion.div>
                  </>
                )}
              </GlassCard>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
};

export default DigitalReceiptTracker;
