import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag, CreditCard, ChevronLeft, Loader2, Check } from 'lucide-react';
import { api } from '../api';
import './pages.css';
import './cart.css';

const CartPage = () => {
  const { cart, addToCart, removeFromCart, totalPrice, totalItems, clearCart } = useCart();
  const navigate = useNavigate();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [diningMode, setDiningMode] = useState('dine_in');
  const [paymentMode, setPaymentMode] = useState('upi');
  const [showQRModal, setShowQRModal] = useState(false);
  const [upiPaymentState, setUpiPaymentState] = useState('idle'); // 'idle' | 'awaiting' | 'verifying' | 'success'

  const cartItems = Object.values(cart);

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (window.verifyTimer) clearTimeout(window.verifyTimer);
      if (window.successTimer) clearTimeout(window.successTimer);
    };
  }, []);

  const executeFinalCheckout = () => {
    setIsCheckingOut(true);
    const userData = JSON.parse(localStorage.getItem('sgu_user') || '{}');
    const orderPayload = {
      customerName: userData.name || 'Guest User',
      customerId: userData.id || '9876543210',
      type: diningMode === 'dine_in' ? 'Dine-In' : 'Takeaway',
      payment: paymentMode === 'upi' ? 'Online UPI' : 'Cash',
      total: totalPrice,
      items: cartItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        stallId: item.stallId || item.stallid,
        stallName: item.stallName || item.stallname
      }))
    };

    api.createOrder(orderPayload)
      .then((createdOrder) => {
        setIsCheckingOut(false);
        setShowQRModal(false);
        setUpiPaymentState('idle');
        const existingOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
        localStorage.setItem('sgu_orders', JSON.stringify([createdOrder, ...existingOrders]));
        clearCart();
        navigate(`/student/order/${createdOrder.id}`);
      })
      .catch((err) => {
        console.error('Checkout failed:', err);
        alert('Order placement failed: ' + err.message);
        setIsCheckingOut(false);
        setShowQRModal(false);
        setUpiPaymentState('idle');
      });
  };

  const handleCheckout = () => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
    
    // If laptop user selects UPI, open the QR payment scanner modal
    if (paymentMode === 'upi' && !isMobile) {
      setShowQRModal(true);
      setUpiPaymentState('awaiting');
      
      // Simulate real-time UPI scan and payment completion
      const verifyTimer = setTimeout(() => {
        setUpiPaymentState('verifying');
        
        const successTimer = setTimeout(() => {
          setUpiPaymentState('success');
          // Automatically proceed with order creation
          executeFinalCheckout();
        }, 2000);
        
        window.successTimer = successTimer;
      }, 4500);
      
      window.verifyTimer = verifyTimer;
      return;
    }

    setIsCheckingOut(true);
    
    const firstItem = cartItems[0] || {};
    const shopVpa = firstItem.stallId ? `${firstItem.stallId.replace('-', '')}@bank` : 'sgu_foodcourt@bank';
    const shopName = firstItem.stallName || 'SGU Food Court';
    const upiLink = `upi://pay?pa=${shopVpa}&pn=${encodeURIComponent(shopName)}&am=${totalPrice}&cu=INR`;

    if (paymentMode === 'upi' && isMobile) {
      // Mobile flow: Redirect directly to mobile payment apps (GPay, PhonePe, Paytm, etc.)
      window.location.href = upiLink;
    }

    executeFinalCheckout();
  };

  const handleCancelPayment = () => {
    if (window.verifyTimer) clearTimeout(window.verifyTimer);
    if (window.successTimer) clearTimeout(window.successTimer);
    setShowQRModal(false);
    setUpiPaymentState('idle');
  };

  if (cartItems.length === 0) {
    return (
      <div className="cart-empty-container page-transition">
        <header className="cart-header">
          <button className="back-btn" onClick={() => navigate('/student')}>
            <ChevronLeft size={24} />
          </button>
          <h1>My Cart</h1>
        </header>
        <div className="empty-state">
          <div className="empty-icon-wrapper">
            <ShoppingBag size={80} className="empty-icon" />
          </div>
          <h2>Your cart is empty</h2>
          <p>Hungry? Explore our delicious menu and add some items!</p>
          <button className="btn-primary-v21 mt-8" onClick={() => navigate('/student')}>
            Browse Shops
          </button>
        </div>
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
                  <img src={item.img || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'} alt={item.name} />
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
                Dine-In
              </button>
              <button 
                className={`mode-btn-v20 ${diningMode === 'takeaway' ? 'active shadow-md' : ''}`}
                onClick={() => setDiningMode('takeaway')}
              >
                Takeaway
              </button>
            </div>
          </div>

          <div className="selection-group">
            <h3>Payment Method</h3>
            <div className="toggle-group-v20">
              <button 
                className={`mode-btn-v20 ${paymentMode === 'upi' ? 'active shadow-md' : ''}`}
                onClick={() => setPaymentMode('upi')}
              >
                Online UPI
              </button>
              <button 
                className={`mode-btn-v20 ${paymentMode === 'cash' ? 'active shadow-md' : ''}`}
                onClick={() => setPaymentMode('cash')}
              >
                Cash
              </button>
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
              <span className="text-green-600">FREE</span>
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

      {/* Custom Laptop UPI QR Modal */}
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
            onClick={handleCancelPayment}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                width: '100%',
                maxWidth: '400px',
                background: 'var(--white)',
                borderRadius: '24px',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(226, 232, 240, 0.8)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {upiPaymentState === 'awaiting' && (
                <>
                  <div className="bg-white p-4 rounded-3xl shadow-lg border border-solid border-slate-100 mb-4" style={{ display: 'inline-block', position: 'relative' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                        `upi://pay?pa=${(cartItems[0]?.stallId || 'general').replace('-', '')}@bank&pn=${encodeURIComponent(cartItems[0]?.stallName || 'SGU Food Court')}&am=${totalPrice}&cu=INR`
                      )}`} 
                      alt="Payment QR" 
                      style={{ width: 180, height: 180, display: 'block' }}
                    />
                    {/* Simulated laser scan bar animation */}
                    <div style={{
                      position: 'absolute',
                      left: '16px',
                      right: '16px',
                      height: '2px',
                      background: 'rgba(228, 0, 43, 0.75)',
                      boxShadow: '0 0 8px #E4002B',
                      animation: 'scan-laser 2.5s infinite ease-in-out',
                      top: '16px',
                    }} />
                    <style>{`
                      @keyframes scan-laser {
                        0% { top: 16px; }
                        50% { top: 196px; }
                        100% { top: 16px; }
                      }
                    `}</style>
                  </div>
                  <h3 className="font-bold text-navy-900 text-lg mb-1">{cartItems[0]?.stallName || 'SGU Food Court'}</h3>
                  <p className="text-xs text-slate-400 font-bold mb-4">UPI VPA: {(cartItems[0]?.stallId || 'general').replace('-', '')}@bank</p>
                  
                  <div className="bg-slate-50 p-3 rounded-2xl w-full flex justify-between items-center mb-4 border border-solid border-slate-100">
                    <span className="text-xs text-slate-500 font-bold uppercase">Amount to Scan</span>
                    <span className="text-xl font-black text-[#E4002B]">₹{totalPrice}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-6" style={{ color: 'var(--primary-navy)', fontWeight: 700, fontSize: '0.85rem' }}>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Awaiting scan from your mobile app...</span>
                  </div>
                </>
              )}

              {upiPaymentState === 'verifying' && (
                <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    border: '3px solid rgba(26, 82, 118, 0.1)',
                    borderTopColor: 'var(--primary-navy)',
                    animation: 'spin 1s infinite linear',
                    marginBottom: '24px'
                  }} />
                  <style>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                  <h3 className="font-bold text-navy-900 text-lg mb-2">Scan Detected!</h3>
                  <p className="text-sm text-slate-500 font-medium px-4">
                    Verifying transaction with your bank. Please do not close this window.
                  </p>
                </div>
              )}

              {upiPaymentState === 'success' && (
                <div style={{ padding: '40px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'var(--success-green)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '24px',
                    boxShadow: '0 10px 20px rgba(34, 197, 94, 0.3)'
                  }}>
                    <Check size={36} strokeWidth={3} />
                  </div>
                  <h3 className="font-bold text-navy-900 text-lg mb-2">Payment Successful!</h3>
                  <p className="text-sm text-slate-500 font-medium px-4">
                    Your payment of ₹{totalPrice} is verified. Redirecting to your receipt...
                  </p>
                </div>
              )}

              <div className="w-full">
                <button 
                  onClick={handleCancelPayment}
                  disabled={upiPaymentState === 'success'}
                  style={{
                    width: '100%', padding: '12px', borderRadius: '12px',
                    border: '1px solid #E2E8F0', background: 'none',
                    fontWeight: 700, fontSize: '0.85rem', cursor: upiPaymentState === 'success' ? 'not-allowed' : 'pointer',
                    color: 'var(--text-muted)',
                    opacity: upiPaymentState === 'success' ? 0.5 : 1
                  }}
                >
                  Cancel Payment
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CartPage;
