import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Utensils, ShoppingBag, Banknote, Smartphone, CheckCircle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import './checkout.css';

export const CheckoutDrawer = ({ isOpen, onClose, cart, inventory }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [diningMode, setDiningMode] = useState('dine_in'); // dine_in | takeaway
  const [paymentMode, setPaymentMode] = useState('upi'); // upi | cash
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const totalCartValue = Object.values(cart).reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

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

  const handleCheckout = () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    setIsProcessing(true);
    
    if (paymentMode === 'upi') {
      // Step 4: UPI Intent
      const upiLink = `upi://pay?pa=SGU_VPA@bank&pn=SGUFoodCourt&am=${totalCartValue}&cu=INR`;
      
      // Simulate Deep Link Click
      const link = document.createElement('a');
      link.href = upiLink;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // Simulate verification (Step 5)
    setTimeout(() => {
      setIsProcessing(false);
      setStep(4); // Success step
      triggerConfetti();
      setTimeout(() => {
        onClose();
        navigate('/student/order/SGU-ULTIMATE');
      }, 3000);
    }, 2000);
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
                    {Object.values(cart).map((item) => (
                      <div key={item.id} className="receipt-item-v20">
                        <span className="qty-badge">{item.quantity}x</span>
                        <span className="item-name">{item.name}</span>
                        <span className="item-price">₹{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="receipt-total-v20">
                    <span>To Pay</span>
                    <span>₹{totalCartValue}</span>
                  </div>
                </div>
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
                    {step < 3 ? 'Continue' : `PAY ₹${totalCartValue}`} 
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
