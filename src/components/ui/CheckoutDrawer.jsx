import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Utensils, ShoppingBag, Banknote, Smartphone, CheckCircle, ArrowRight, Trash2, Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useCart } from '../../context/CartContext';
import { api } from '../../api';
import './checkout.css';

export const CheckoutDrawer = ({ isOpen, onClose, cart, inventory, onComplete }) => {
  const navigate = useNavigate();
  const { addToCart, removeFromCart, clearCart } = useCart();
  const [step, setStep] = useState(1);
  const [diningMode, setDiningMode] = useState('dine_in'); // dine_in | takeaway
  const [paymentMode, setPaymentMode] = useState('upi'); // upi | cash
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const cartItems = Object.values(cart);
  const totalCartValue = cartItems.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  // Auto-close if cart becomes empty
  if (cartItems.length === 0 && step === 1) {
    setTimeout(() => onClose(), 100);
    return null;
  }

  const triggerConfetti = () => {
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#22C55E', '#1A5276', '#F59E0B']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#22C55E', '#1A5276', '#F59E0B']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  const submitOrder = () => {
    setIsProcessing(true);
    
    // Submit order to API
    const userData = JSON.parse(localStorage.getItem('sgu_user') || '{}');
    const orderPayload = {
      customerName: userData.name || 'Guest User',
      customerId: userData.id || '9876543210',
      type: diningMode === 'dine_in' ? 'Dine-In' : 'Takeaway',
      payment: paymentMode === 'upi' ? 'Online UPI' : 'Cash',
      total: totalCartValue,
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
        setIsProcessing(false);
        setStep(4); // Success step
        triggerConfetti();

        const existingOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
        localStorage.setItem('sgu_orders', JSON.stringify([createdOrder, ...existingOrders]));

        setTimeout(() => {
          clearCart();
          onClose();
          if (typeof onComplete === 'function') onComplete();
          navigate(`/student/order/${createdOrder.id}`);
        }, 3000);
      })
      .catch((err) => {
        console.error('Checkout failed:', err);
        alert('Order placement failed: ' + err.message);
        setIsProcessing(false);
      });
  };

  const handleCheckout = () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    if (step === 3 && paymentMode === 'upi') {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
      
      const firstItem = cartItems[0] || {};
      const shopVpa = firstItem.stallId ? `${firstItem.stallId.replace('-', '')}@bank` : 'sgu_foodcourt@bank';
      const shopName = firstItem.stallName || 'SGU Food Court';
      const upiLink = `upi://pay?pa=${shopVpa}&pn=${encodeURIComponent(shopName)}&am=${totalCartValue}&cu=INR`;

      if (isMobile) {
        // Mobile flow: Redirect to GPay/PhonePe deep link
        const link = document.createElement('a');
        link.href = upiLink;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Immediately submit the order
        submitOrder();
      } else {
        // Laptop/Desktop flow: Show the custom QR code instead
        setStep(3.5);
      }
      return;
    }

    submitOrder();
  };

  return (
    <div className="drawer-overlay-v22 blur-20px" onClick={!isProcessing ? onClose : undefined}>
      <motion.div 
        className="drawer-content-v20 shadow-2xl" 
        onClick={e => e.stopPropagation()}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="drawer-header-v20">
          <h2>
            {step === 1 && '1. Cart Summary'}
            {step === 2 && '2. Dining Mode'}
            {step === 3 && '3. Payment Options'}
            {step === 3.5 && 'Scan QR to Pay'}
            {step === 4 && 'Order Confirmed!'}
          </h2>
          {!isProcessing && step < 4 && (
            <button className="close-btn tap-effect" onClick={onClose}><X size={24} /></button>
          )}
        </div>

        <div className="drawer-body-v20">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="receipt-preview-v20 shadow-md">
                  <div className="item-list-v20">
                    {cartItems.map((item) => (
                      <div key={item.id} className="receipt-item-v20" style={{ alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <button 
                            className="tap-effect"
                            onClick={() => removeFromCart(item.id)}
                            style={{
                              width: '28px', height: '28px', borderRadius: '50%',
                              background: 'var(--bg-soft-gray)', border: '1px solid #E2E8F0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: 'var(--text-muted)',
                            }}
                          >
                            <Minus size={14} />
                          </button>
                          <span style={{ 
                            fontFamily: 'var(--font-heading)', fontWeight: 800, 
                            fontSize: '1rem', minWidth: '20px', textAlign: 'center',
                            color: 'var(--text-dark)',
                          }}>{item.quantity}</span>
                          <button 
                            className="tap-effect"
                            onClick={() => addToCart(item)}
                            style={{
                              width: '28px', height: '28px', borderRadius: '50%',
                              background: 'var(--bg-soft-gray)', border: '1px solid #E2E8F0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: 'var(--text-dark)',
                            }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <span className="item-name" style={{ flex: 1, fontWeight: 600 }}>{item.name}</span>
                        <span className="item-price" style={{ fontWeight: 700, marginRight: '8px' }}>₹{item.price * item.quantity}</span>
                        <button
                          className="tap-effect"
                          onClick={() => {
                            // Remove all of this item
                            for (let i = 0; i < item.quantity; i++) {
                              removeFromCart(item.id);
                            }
                          }}
                          style={{
                            width: '28px', height: '28px', borderRadius: '8px',
                            background: 'rgba(228, 0, 43, 0.08)', border: 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#E4002B', flexShrink: 0,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="receipt-total-v20">
                    <span>To Pay</span>
                    <span>₹{totalCartValue}</span>
                  </div>
                </div>
                {/* Clear All button */}
                <button 
                  onClick={() => { clearCart(); onClose(); }}
                  style={{
                    width: '100%', padding: '10px', marginTop: '12px',
                    background: 'none', border: '1px solid rgba(228, 0, 43, 0.2)',
                    borderRadius: '10px', color: '#E4002B', fontWeight: 700,
                    fontSize: '0.85rem', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}
                >
                  <Trash2 size={14} /> Clear Entire Cart
                </button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="selection-group-v20">
                  <div className="toggle-group-v20">
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      className={`mode-btn-v20 ${diningMode === 'dine_in' ? 'active shadow-md' : ''}`}
                      onClick={() => setDiningMode('dine_in')}
                    >
                      <Utensils size={32} /> Dine-In
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      className={`mode-btn-v20 ${diningMode === 'takeaway' ? 'active shadow-md' : ''}`}
                      onClick={() => setDiningMode('takeaway')}
                    >
                      <ShoppingBag size={32} /> Takeaway
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
                <div className="selection-group-v20">
                  <div className="toggle-group-v20">
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      className={`mode-btn-v20 ${paymentMode === 'upi' ? 'active shadow-md' : ''}`}
                      onClick={() => setPaymentMode('upi')}
                    >
                      <Smartphone size={32} /> Online UPI
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      className={`mode-btn-v20 ${paymentMode === 'cash' ? 'active shadow-md' : ''}`}
                      onClick={() => setPaymentMode('cash')}
                    >
                      <Banknote size={32} /> Cash at Counter
                    </motion.button>
                  </div>
                  <p className="payment-helper-text mt-4 text-muted">
                    {paymentMode === 'upi' 
                      ? 'Opens GPay/PhonePe automatically.' 
                      : 'You must pay at the counter before order preparation begins.'}
                  </p>
                </div>
              </motion.div>
            )}

            {step === 3.5 && (
              <motion.div key="step3_5" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col items-center text-center py-4">
                <div className="bg-white p-4 rounded-3xl shadow-lg border border-solid border-slate-100 mb-4" style={{ display: 'inline-block' }}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      `upi://pay?pa=${(cartItems[0]?.stallId || 'general').replace('-', '')}@bank&pn=${encodeURIComponent(cartItems[0]?.stallName || 'SGU Food Court')}&am=${totalCartValue}&cu=INR`
                    )}`} 
                    alt="Payment QR" 
                    style={{ width: 180, height: 180, display: 'block' }}
                  />
                </div>
                <h3 className="font-bold text-navy-900 text-lg mb-1">{cartItems[0]?.stallName || 'SGU Food Court'}</h3>
                <p className="text-xs text-slate-400 font-bold mb-4">UPI VPA: {(cartItems[0]?.stallId || 'general').replace('-', '')}@bank</p>
                <div className="bg-slate-50 p-3 rounded-2xl w-full flex justify-between items-center mb-4 border border-solid border-slate-100">
                  <span className="text-xs text-slate-500 font-bold uppercase">Amount to Scan</span>
                  <span className="text-xl font-black text-[#E4002B]">₹{totalCartValue}</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium px-4">
                  Please open any UPI app (GPay, PhonePe, Paytm) on your phone and scan the QR code above to complete your payment.
                </p>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="success-state shadow-lg py-8 flex flex-col gap-4">
                <CheckCircle size={64} color="white" /> 
                <span className="heading-2">Payment Verified!</span>
                <p className="text-white opacity-80">Generating Receipt...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="drawer-footer-v20">
          <AnimatePresence mode="wait">
            {step < 4 && (
              <motion.button 
                key="button"
                whileTap={!isProcessing ? { scale: 0.97 } : {}}
                className={`pay-btn-v20 shadow-lg ${isProcessing ? 'processing' : ''}`}
                onClick={handleCheckout}
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : (
                  <>
                    {step < 3 ? 'Continue' : step === 3.5 ? 'Verify & Place Order' : `PAY ₹${totalCartValue}`} 
                    <ArrowRight size={20} className="ml-2" />
                  </>
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
