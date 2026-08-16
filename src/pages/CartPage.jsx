import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, Plus, Minus, ArrowRight, ShoppingBag, ChevronLeft, 
  Loader2, Check, ExternalLink, Smartphone, Copy, ShieldCheck, 
  Utensils, AlertCircle, XCircle, CheckCircle, Hash
} from 'lucide-react';
import { api } from '../api';
import { getFoodItemImage } from '../utils/imageHelper';
import { getStoredUser } from '../utils/auth';
import { SHOP_PAYMENT_CONFIG, isMobileDevice } from '../config/paymentConfig';
import './pages.css';
import './cart.css';

const CartPage = () => {
  const { cart, addToCart, removeFromCart, totalPrice, totalItems, clearCart } = useCart();
  const navigate = useNavigate();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [diningMode, setDiningMode] = useState('dine_in'); // 'dine_in' | 'takeaway'
  const [showQRModal, setShowQRModal] = useState(false);
  const [upiPaymentState, setUpiPaymentState] = useState('idle'); // 'idle' | 'verifying' | 'success' | 'failed'
  const [errorMessage, setErrorMessage] = useState('');
  const [recentOrders, setRecentOrders] = useState([]);
  const [copiedField, setCopiedField] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');

  const cartItems = Object.values(cart);

  useEffect(() => {
    setIsMobile(isMobileDevice());
    const userData = getStoredUser() || {};
    const customerId = (userData.id || userData.username || '9876543210').trim().toLowerCase();

    api.getStudentOrders(customerId)
      .then(orders => {
        const localOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
        const merged = [...(orders || [])];
        localOrders.forEach(localOrder => {
          const orderObj = localOrder.order || localOrder;
          if (orderObj && orderObj.id && !merged.find(o => o.id === orderObj.id)) {
            merged.push(orderObj);
          }
        });
        merged.sort((a, b) => String(b.id).localeCompare(String(a.id)));
        setRecentOrders(merged);
      })
      .catch(err => {
        console.error('Failed to load orders for cart page:', err);
        setRecentOrders(JSON.parse(localStorage.getItem('sgu_orders') || '[]'));
      });
  }, []);

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(type);
      setTimeout(() => setCopiedField(''), 2500);
    }).catch(() => {
      setCopiedField(type);
      setTimeout(() => setCopiedField(''), 2500);
    });
  };

  /**
   * STRICT POST-PAYMENT FINAL CHECKOUT:
   * Only called when the user verifies their payment with a valid 12-digit UTR.
   * If payment is not done, NO ORDER is placed and NO vendor event is sent.
   */
  const handleVerifyAndConfirmPayment = () => {
    setErrorMessage('');
    const cleanUtr = utrNumber.trim();

    if (!cleanUtr || cleanUtr.length !== 12 || !/^\d{12}$/.test(cleanUtr)) {
      setErrorMessage('Payment not completed: Please complete the payment on your UPI app and enter the 12-digit UPI Ref / UTR number from your payment receipt.');
      return;
    }

    setUpiPaymentState('verifying');
    setIsCheckingOut(true);

    const userData = getStoredUser() || {};
    const firstItem = cartItems[0] || {};
    const stallId = firstItem.stallId || firstItem.stallid || 'general';
    const stallName = firstItem.stallName || firstItem.stallname || 'SGU Food Court';

    const orderPayload = {
      customerName: userData.name || 'Guest User',
      customerId: (userData.id || userData.username || '9876543210').toString(),
      type: diningMode === 'dine_in' ? 'Dine-In' : 'Takeaway',
      payment: 'Online UPI',
      total: totalPrice,
      utr: cleanUtr,
      items: cartItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        stallId: item.stallId || item.stallid || stallId,
        stallName: item.stallName || item.stallname || stallName
      }))
    };

    api.createOrder(orderPayload)
      .then((response) => {
        setIsCheckingOut(false);
        setUpiPaymentState('success');
        const actualOrder = response.order || response;
        const existingOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
        localStorage.setItem('sgu_orders', JSON.stringify([actualOrder, ...existingOrders]));

        setTimeout(() => {
          clearCart();
          setShowQRModal(false);
          setUpiPaymentState('idle');
          navigate(`/student/order/${actualOrder.id}`);
        }, 2200);
      })
      .catch((err) => {
        console.error('Checkout verification failed:', err);
        setUpiPaymentState('idle');
        setIsCheckingOut(false);
        setErrorMessage(err.message || 'Payment verification failed: No payment detected for account 9607102196.');
      });
  };

  /**
   * Handle Proceed to Pay:
   * - Laptop: Displays QR code with locked amount.
   * - Mobile: Redirects directly to UPI app.
   */
  const handleCheckout = () => {
    const mobileDetected = isMobileDevice();
    setIsMobile(mobileDetected);
    setShowQRModal(true);
    setUpiPaymentState('idle');
    setErrorMessage('');
    setUtrNumber('');

    if (mobileDetected) {
      const firstItem = cartItems[0] || {};
      const shopName = firstItem.stallName || 'SGU Food Court';
      const upiUri = SHOP_PAYMENT_CONFIG.getUpiUri(totalPrice, shopName);
      
      const link = document.createElement('a');
      link.href = upiUri;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleOpenUpiAppAgain = () => {
    const firstItem = cartItems[0] || {};
    const shopName = firstItem.stallName || 'SGU Food Court';
    const upiUri = SHOP_PAYMENT_CONFIG.getUpiUri(totalPrice, shopName);
    window.location.href = upiUri;
  };

  /**
   * CANCEL PAYMENT / PAYMENT INCOMPLETE:
   * Cancels payment completely, displays "Payment Incomplete", and redirects back to cart.
   * NO order is placed, NO Order ID generated, and NOTHING is sent to vendor dashboard.
   */
  const handlePaymentIncomplete = () => {
    setUpiPaymentState('failed');
    setErrorMessage('Payment Incomplete: Transaction cancelled. Returning to cart...');

    setTimeout(() => {
      setShowQRModal(false);
      setUpiPaymentState('idle');
      setIsCheckingOut(false);
      setErrorMessage('');
    }, 1400);
  };

  const firstItem = cartItems[0] || {};
  const currentShopName = firstItem.stallName || 'SGU Food Court';
  const qrUrl = SHOP_PAYMENT_CONFIG.getQrCodeUrl(totalPrice, currentShopName);

  if (cartItems.length === 0) {
    return (
      <div className="cart-empty-container page-transition">
        <header className="cart-header">
          <button className="back-btn" onClick={() => navigate('/student')}>
            <ChevronLeft size={24} />
          </button>
          <h1>My Cart</h1>
        </header>
        {recentOrders.length === 0 ? (
          <div className="empty-state" style={{ paddingBottom: 20 }}>
            <div className="empty-icon-wrapper">
              <ShoppingBag size={64} className="empty-icon" />
            </div>
            <h2>Your cart is empty</h2>
            <p>Hungry? Explore our delicious menu and add some items!</p>
            <button className="btn-primary-v21 mt-6" onClick={() => navigate('/student')}>
              Browse Menu & Stalls
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 20px 10px 20px' }}>
            <button className="btn-primary-v21" onClick={() => navigate('/student')} style={{ maxWidth: 220, margin: '0 auto', fontSize: '0.9rem', padding: '10px 20px' }}>
              <ShoppingBag size={18} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
              Order More Items
            </button>
          </div>
        )}

        {/* Placed Orders List inside Cart */}
        {recentOrders.length > 0 && (
          <div style={{ maxWidth: 480, margin: '0 auto', padding: '10px 20px 40px 20px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', margin: 0 }}>
                My Placed Orders ({recentOrders.length})
              </h3>
              <button onClick={() => navigate('/student/orders')} style={{ background: 'none', border: 'none', color: '#FF3B5C', fontSize: '0.8rem', fontWeight: 800, cursor: 'pointer' }}>
                View All →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {recentOrders.slice(0, 3).map((rawOrder) => {
                const order = rawOrder.order || rawOrder;
                if (!order || !order.id) return null;
                
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
                  <div 
                    key={order.id}
                    onClick={() => navigate(`/student/order/${order.id}`)}
                    style={{
                      background: 'white',
                      padding: '16px 20px',
                      borderRadius: 16,
                      border: '1px solid #E2E8F0',
                      borderLeft: `5px solid ${statusColor}`,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
                    className="tap-effect"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 900, fontFamily: "'Oswald', sans-serif", fontSize: '1rem' }}>#{order.id}</span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 900, padding: '4px 10px', borderRadius: 999, background: statusBg, color: statusColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {statusLabel}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, margin: '0 0 12px 0', lineHeight: 1.5, whiteSpace: 'normal', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {itemsText}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px dashed #E2E8F0' }}>
                      <span style={{ fontWeight: 800, fontFamily: "'Oswald', sans-serif", fontSize: '1.1rem' }}>₹{order.total}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#FF3B5C', display: 'flex', alignItems: 'center', gap: 6 }}>
                        Track Ticket <ExternalLink size={14} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cart-page-container page-transition">
      <header className="cart-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} />
        </button>
        <h1>My Cart</h1>
        <button className="clear-btn" onClick={clearCart}>
          <Trash2 size={20} />
        </button>
      </header>

      <main className="cart-content">
        <div className="cart-items-list">
          <AnimatePresence>
            {cartItems.map((item) => (
              <motion.div 
                key={item.id} 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="cart-item-card shadow-sm"
              >
                <div className="cart-item-img">
                  <img src={getFoodItemImage(item)} alt={item.name} />
                </div>
                <div className="cart-item-details">
                  <h3>{item.name}</h3>
                  <p className="stall-name">{item.stallName}</p>
                  <p className="item-price-total">₹{item.price * item.quantity}</p>
                </div>
                <div className="cart-item-actions">
                  <div className="qty-picker">
                    <button onClick={() => removeFromCart(item.id)} className="qty-btn">
                      <Minus size={16} />
                    </button>
                    <span className="qty-val">{item.quantity}</span>
                    <button onClick={() => addToCart(item)} className="qty-btn">
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="cart-selections">
          <div className="selection-group">
            <h3>Dining Mode</h3>
            <div className="toggle-group-v20">
              <button 
                className={`mode-btn-v20 ${diningMode === 'dine_in' ? 'active shadow-md' : ''}`}
                onClick={() => setDiningMode('dine_in')}
              >
                <Utensils size={18} /> Dine-In
              </button>
              <button 
                className={`mode-btn-v20 ${diningMode === 'takeaway' ? 'active shadow-md' : ''}`}
                onClick={() => setDiningMode('takeaway')}
              >
                <ShoppingBag size={18} /> Takeaway
              </button>
            </div>
          </div>

          <div className="selection-group">
            <h3>Shop Bank Account & Locked Bill</h3>
            <div className="bank-account-box">
              <div className="flex justify-between items-center mb-2">
                <span className="bank-badge">
                  <ShieldCheck size={12} /> Shop Bank Account
                </span>
                <span className="text-[11px] font-bold text-blue-700">Non-Editable Bill</span>
              </div>

              <div className="text-xs text-slate-600 font-semibold mb-1">
                Beneficiary: <strong className="text-navy-900">{SHOP_PAYMENT_CONFIG.payeeName}</strong>
              </div>

              <div className="bank-detail-row">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">UPI ID</span>
                  <span className="text-sm font-black text-navy-900">{SHOP_PAYMENT_CONFIG.primaryUpiId}</span>
                </div>
                <button 
                  className="copy-pill-btn"
                  onClick={() => handleCopy(SHOP_PAYMENT_CONFIG.primaryUpiId, 'upi')}
                >
                  {copiedField === 'upi' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                  {copiedField === 'upi' ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="bank-detail-row">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Bank Linked Phone</span>
                  <span className="text-sm font-black text-navy-900">{SHOP_PAYMENT_CONFIG.phone}</span>
                </div>
                <button 
                  className="copy-pill-btn"
                  onClick={() => handleCopy(SHOP_PAYMENT_CONFIG.phone, 'phone')}
                >
                  {copiedField === 'phone' ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                  {copiedField === 'phone' ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="cart-summary-section">
          <div className="summary-card shadow-lg">
            <div className="summary-row">
              <span>Item Total ({totalItems})</span>
              <span>₹{totalPrice}</span>
            </div>
            <div className="summary-row">
              <span>Delivery / Platform Fee</span>
              <span className="text-green-600 font-bold">FREE</span>
            </div>
            <div className="summary-row total">
              <span>Grand Total</span>
              <span>₹{totalPrice}</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="cart-footer">
        <motion.button 
          whileTap={{ scale: 0.95 }}
          className={`checkout-btn-v21 shadow-2xl ${isCheckingOut ? 'loading' : ''}`}
          onClick={handleCheckout}
          disabled={isCheckingOut}
        >
          {isCheckingOut ? 'Processing...' : (
            <>
              <span>Proceed to Pay ₹{totalPrice}</span>
              <ArrowRight size={20} />
            </>
          )}
        </motion.button>
      </footer>

      {/* Payment Verification & Order Finalization Modal */}
      <AnimatePresence>
        {showQRModal && (
          <div 
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={upiPaymentState === 'idle' ? handlePaymentIncomplete : undefined}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                width: '100%',
                maxWidth: '420px',
                background: '#FFFFFF',
                borderRadius: '28px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                border: '1px solid rgba(226, 232, 240, 0.8)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Error Banner */}
              {errorMessage && (
                <div className="w-full mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-left flex items-start gap-2">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <span className="text-xs font-bold text-red-800">{errorMessage}</span>
                </div>
              )}

              {upiPaymentState === 'failed' ? (
                /* ─── PAYMENT INCOMPLETE STATE ─── */
                <div className="payment-incomplete-box w-full my-2">
                  <XCircle size={52} color="#DC2626" />
                  <h3 className="font-bold text-red-900 text-xl">Payment Incomplete</h3>
                  <p className="text-xs text-red-700 font-medium">
                    Payment was not completed. Order has been cancelled and was <strong>not</strong> sent to the vendor dashboard.
                  </p>
                  <span className="text-[11px] text-slate-500 font-bold">Redirecting you back to cart...</span>
                </div>
              ) : !isMobile ? (
                /* ─── LAPTOP VIEW: DYNAMIC QR CODE WITH STRICT VERIFICATION ─── */
                <>
                  <div className="qr-frame-wrapper mb-2">
                    <img 
                      src={qrUrl} 
                      alt="Payment QR" 
                      style={{ width: 170, height: 170, display: 'block', borderRadius: 12 }}
                    />
                    <div className="qr-laser-line" />
                  </div>

                  <h3 className="font-bold text-navy-900 text-base mb-0">{currentShopName}</h3>
                  
                  <div className="flex items-center gap-2 justify-center my-1.5 flex-wrap">
                    <button 
                      onClick={() => handleCopy(SHOP_PAYMENT_CONFIG.primaryUpiId, 'upi')}
                      className="copy-pill-btn text-xs font-bold"
                    >
                      UPI: {SHOP_PAYMENT_CONFIG.primaryUpiId}
                      {copiedField === 'upi' ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    </button>
                    <button 
                      onClick={() => handleCopy(SHOP_PAYMENT_CONFIG.phone, 'phone')}
                      className="copy-pill-btn text-xs font-bold"
                    >
                      Phone: {SHOP_PAYMENT_CONFIG.phone}
                      {copiedField === 'phone' ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    </button>
                  </div>
                  
                  <div className="bg-slate-50 p-2.5 rounded-2xl w-full flex justify-between items-center my-1.5 border border-solid border-slate-100">
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Exact Locked Total</span>
                      <span className="text-xs text-green-700 font-bold">Non-Editable</span>
                    </div>
                    <span className="text-2xl font-black text-[#E4002B]">₹{totalPrice}</span>
                  </div>

                  {/* 12-Digit UTR Entry */}
                  <div className="w-full mt-2 mb-1 text-left">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-1">
                      <Hash size={13} className="text-blue-700" />
                      12-Digit UPI Ref / UTR No. (From your payment receipt):
                    </label>
                    <input 
                      type="text"
                      maxLength={12}
                      placeholder="e.g. 423891028471"
                      value={utrNumber}
                      onChange={(e) => {
                        setErrorMessage('');
                        setUtrNumber(e.target.value.replace(/[^0-9]/g, ''));
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: errorMessage ? '2px solid #EF4444' : '1.5px solid #CBD5E1',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: '#0F172A',
                        boxSizing: 'border-box',
                        outline: 'none',
                        letterSpacing: '1px'
                      }}
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {utrNumber.length}/12 digits entered
                    </span>
                  </div>

                  {/* Verify & Place Order Button */}
                  <div className="w-full mt-2">
                    <button 
                      onClick={handleVerifyAndConfirmPayment}
                      disabled={upiPaymentState === 'verifying'}
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: upiPaymentState === 'verifying' ? '#94A3B8' : 'linear-gradient(135deg, #16A34A, #15803D)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '14px',
                        fontWeight: 800,
                        fontSize: '1rem',
                        fontFamily: "var(--font-heading, 'Oswald', sans-serif)",
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        cursor: upiPaymentState === 'verifying' ? 'not-allowed' : 'pointer',
                        boxShadow: '0 6px 18px rgba(22, 163, 74, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                      className="tap-effect"
                    >
                      {upiPaymentState === 'verifying' ? (
                        <>
                          <Loader2 className="animate-spin" size={18} />
                          <span>Verifying Bank Transaction...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={18} />
                          <span>Verify Payment & Place Order</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                /* ─── MOBILE VIEW: REDIRECTION SCREEN ─── */
                <div className="w-full flex flex-col items-center py-2">
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'rgba(30, 64, 175, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#1E40AF', marginBottom: 12
                  }}>
                    <Smartphone size={32} />
                  </div>

                  <h3 className="font-bold text-navy-900 text-lg mb-1">Redirected to UPI App</h3>
                  <p className="text-xs text-slate-500 font-medium px-4 mb-3">
                    Your payment app was opened with the pre-filled, non-editable amount of <strong>₹{totalPrice}</strong> for account <strong>{SHOP_PAYMENT_CONFIG.phone}</strong>.
                  </p>

                  <div className="bg-slate-50 p-2.5 rounded-2xl w-full flex justify-between items-center mb-3 border border-solid border-slate-100">
                    <div className="text-left">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Bill Amount</span>
                      <span className="text-xs text-blue-700 font-bold">Non-Editable</span>
                    </div>
                    <span className="text-2xl font-black text-[#E4002B]">₹{totalPrice}</span>
                  </div>

                  <button 
                    onClick={handleOpenUpiAppAgain}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: '#EFF6FF',
                      color: '#1E40AF',
                      border: '1.5px solid #BFDBFE',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      marginBottom: '10px'
                    }}
                    className="tap-effect"
                  >
                    <ExternalLink size={15} /> Re-open Payment App
                  </button>

                  {/* UTR Entry */}
                  <div className="w-full text-left mb-2">
                    <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1 mb-1">
                      <Hash size={13} className="text-blue-700" />
                      12-Digit UPI Ref / UTR No.:
                    </label>
                    <input 
                      type="text"
                      maxLength={12}
                      placeholder="e.g. 423891028471"
                      value={utrNumber}
                      onChange={(e) => {
                        setErrorMessage('');
                        setUtrNumber(e.target.value.replace(/[^0-9]/g, ''));
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: errorMessage ? '2px solid #EF4444' : '1.5px solid #CBD5E1',
                        borderRadius: '12px',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                        color: '#0F172A',
                        boxSizing: 'border-box',
                        outline: 'none',
                        letterSpacing: '1px'
                      }}
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {utrNumber.length}/12 digits entered
                    </span>
                  </div>

                  {/* Verify Action */}
                  <div className="w-full mt-1">
                    <button 
                      onClick={handleVerifyAndConfirmPayment}
                      disabled={upiPaymentState === 'verifying'}
                      style={{
                        width: '100%',
                        padding: '14px',
                        background: upiPaymentState === 'verifying' ? '#94A3B8' : 'linear-gradient(135deg, #16A34A, #15803D)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '14px',
                        fontWeight: 800,
                        fontSize: '1rem',
                        fontFamily: "var(--font-heading, 'Oswald', sans-serif)",
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                        cursor: upiPaymentState === 'verifying' ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                      className="tap-effect shadow-md"
                    >
                      {upiPaymentState === 'verifying' ? (
                        <>
                          <Loader2 className="animate-spin" size={18} />
                          <span>Verifying Bank Transaction...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle size={18} />
                          <span>Verify Payment & Place Order</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {upiPaymentState === 'success' && (
                <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#10B981',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px',
                    boxShadow: '0 10px 20px rgba(16, 185, 129, 0.3)'
                  }}>
                    <Check size={36} strokeWidth={3} />
                  </div>
                  <h3 className="font-bold text-navy-900 text-xl mb-2">Payment Verified!</h3>
                  <p className="text-sm text-slate-500 font-medium px-4">
                    Order confirmed and transmitted to kitchen dashboard. Redirecting to receipt ticket...
                  </p>
                </div>
              )}

              {/* Cancel Button */}
              {upiPaymentState !== 'failed' && upiPaymentState !== 'success' && (
                <div className="w-full mt-2">
                  <button 
                    onClick={handlePaymentIncomplete}
                    disabled={upiPaymentState === 'verifying'}
                    style={{
                      width: '100%', padding: '10px', borderRadius: '12px',
                      border: '1px solid #E2E8F0', background: 'none',
                      fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
                      color: '#DC2626'
                    }}
                  >
                    Payment Incomplete / Cancel Order
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CartPage;
