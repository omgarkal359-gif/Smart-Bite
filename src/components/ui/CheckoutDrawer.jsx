import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Utensils, ShoppingBag, Smartphone, CheckCircle, ArrowRight, 
  Trash2, Plus, Minus, Copy, Check, QrCode, ShieldCheck, Loader2, ArrowLeft,
  AlertCircle, ExternalLink, XCircle, Hash
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useCart } from '../../context/CartContext';
import { api } from '../../api';
import { getStoredUser } from '../../utils/auth';
import { SHOP_PAYMENT_CONFIG, isMobileDevice } from '../../config/paymentConfig';
import './checkout.css';

export const CheckoutDrawer = ({ isOpen, onClose, cart, inventory, onComplete }) => {
  const navigate = useNavigate();
  const { addToCart, removeFromCart, clearCart } = useCart();
  const [step, setStep] = useState(1);
  const [diningMode, setDiningMode] = useState('dine_in'); // dine_in | takeaway
  const [paymentMode, setPaymentMode] = useState('upi'); // upi
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [placedOrderId, setPlacedOrderId] = useState(null);
  const [copiedField, setCopiedField] = useState(''); // 'upi' | 'phone'
  const [isMobile, setIsMobile] = useState(false);
  const [utrNumber, setUtrNumber] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setDiningMode('dine_in');
      setPaymentMode('upi');
      setIsVerifying(false);
      setErrorMessage('');
      setPlacedOrderId(null);
      setCopiedField('');
      setIsMobile(isMobileDevice());
      setUtrNumber('');
    }
  }, [isOpen]);

  const cartItems = Object.values(cart);
  const totalCartValue = cartItems.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  if (!isOpen) return null;
  if (cartItems.length === 0 && step === 1) {
    onClose();
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
   * STRICT PAYMENT VERIFICATION & ORDER PLACEMENT:
   * Only called when the user provides a valid 12-digit UTR and payment is confirmed.
   * If payment has not been completed, IT WILL NOT PLACE ANY ORDER.
   */
  const handleVerifyAndConfirmPayment = () => {
    setErrorMessage('');
    const cleanUtr = utrNumber.trim();

    // 1. Mandatory check: Must be 12 digits
    if (!cleanUtr || cleanUtr.length !== 12 || !/^\d{12}$/.test(cleanUtr)) {
      setErrorMessage('Payment not completed: Please complete the payment on your UPI app and enter the 12-digit UPI Ref / UTR number from your payment receipt.');
      return;
    }

    setIsVerifying(true);
    const userData = getStoredUser() || {};
    const firstItem = cartItems[0] || {};
    const stallId = firstItem.stallId || firstItem.stallid || 'general';
    const stallName = firstItem.stallName || firstItem.stallname || 'SGU Food Court';

    const orderPayload = {
      customerName: userData.name || 'Guest Student',
      customerId: (userData.id || userData.username || '9876543210').toString(),
      type: diningMode === 'dine_in' ? 'Dine-In' : 'Takeaway',
      payment: 'Online UPI',
      total: totalCartValue,
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
        setIsVerifying(false);
        const actualOrder = response.order || response;
        setPlacedOrderId(actualOrder.id);
        setStep(4);
        triggerConfetti();

        const existingOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
        localStorage.setItem('sgu_orders', JSON.stringify([actualOrder, ...existingOrders]));

        setTimeout(() => {
          clearCart();
          onClose();
          if (typeof onComplete === 'function') onComplete();
          navigate(`/student/order/${actualOrder.id}`);
        }, 2600);
      })
      .catch((err) => {
        console.error('Payment verification failed:', err);
        setIsVerifying(false);
        setErrorMessage(err.message || 'Payment verification failed: No payment was detected on account 9607102196.');
      });
  };

  /**
   * Proceeds to Payment Screen:
   * - Laptop: Shows dynamic QR Code with locked amount.
   * - Mobile: Redirects directly to UPI payment app with uneditable amount.
   */
  const handleProceedToPayment = () => {
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    if (step === 3) {
      const mobileDetected = isMobileDevice();
      setIsMobile(mobileDetected);
      setStep(3.5);
      setErrorMessage('');

      if (mobileDetected) {
        // Direct redirection to UPI app with locked, uneditable amount
        const shopName = cartItems[0]?.stallName || 'SGU Food Court';
        const upiUri = SHOP_PAYMENT_CONFIG.getUpiUri(totalCartValue, shopName);
        
        const link = document.createElement('a');
        link.href = upiUri;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  /**
   * CANCEL PAYMENT / PAYMENT INCOMPLETE:
   * Aborts payment completely, shows "Payment Incomplete", and redirects back to cart.
   * NO order is placed, NO Order ID generated, and NOTHING is sent to vendor dashboard.
   */
  const handlePaymentIncomplete = () => {
    setIsVerifying(false);
    setErrorMessage('Payment Incomplete: Transaction was not completed. Returning to cart...');

    setTimeout(() => {
      setStep(1); // Return to cart
      setErrorMessage('');
      onClose();
    }, 1400);
  };

  const handleLaunchUpiAppAgain = () => {
    const shopName = cartItems[0]?.stallName || 'SGU Food Court';
    const upiUri = SHOP_PAYMENT_CONFIG.getUpiUri(totalCartValue, shopName);
    window.location.href = upiUri;
  };

  const firstItem = cartItems[0] || {};
  const currentShopName = firstItem.stallName || 'SGU Food Court';
  const qrUrl = SHOP_PAYMENT_CONFIG.getQrCodeUrl(totalCartValue, currentShopName);

  return (
    <div className="drawer-overlay-v22 blur-20px" onClick={!isVerifying ? onClose : undefined}>
      <motion.div 
        className="drawer-content-v20 shadow-2xl" 
        onClick={e => e.stopPropagation()}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="drawer-header-v20">
          <div className="flex items-center gap-2">
            {step === 3.5 && !isVerifying && (
              <button 
                className="tap-effect" 
                onClick={() => setStep(3)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h2>
              {step === 1 && '1. Cart Summary'}
              {step === 2 && '2. Dining Mode'}
              {step === 3 && '3. Payment Method'}
              {step === 3.5 && (isMobile ? 'Mobile UPI Payment' : 'Scan QR on Laptop')}
              {step === 4 && 'Payment Done & Order Confirmed!'}
            </h2>
          </div>
          {!isVerifying && step < 4 && (
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
                              background: '#F1F5F9', border: '1px solid #E2E8F0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: '#64748B',
                            }}
                          >
                            <Minus size={14} />
                          </button>
                          <span style={{ 
                            fontFamily: 'var(--font-heading)', fontWeight: 800, 
                            fontSize: '1rem', minWidth: '20px', textAlign: 'center',
                            color: '#0F172A',
                          }}>{item.quantity}</span>
                          <button 
                            className="tap-effect"
                            onClick={() => addToCart(item)}
                            style={{
                              width: '28px', height: '28px', borderRadius: '50%',
                              background: '#F1F5F9', border: '1px solid #E2E8F0',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: '#0F172A',
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
              <motion.div key="step3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex flex-col gap-4">
                <div className="selection-group-v20">
                  <div className="toggle-group-v20">
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      className="mode-btn-v20 active shadow-md"
                      onClick={() => setPaymentMode('upi')}
                      style={{ width: '100%', padding: '16px' }}
                    >
                      <Smartphone size={32} />
                      <span style={{ fontSize: '1rem', fontWeight: 800 }}>Instant UPI / Bank Transfer</span>
                    </motion.button>
                  </div>
                </div>

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

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-[11.5px] text-amber-900 flex items-start gap-2">
                  <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <span>
                    Exact amount <strong>₹{totalCartValue}</strong> is locked. Order is generated and sent to vendor dashboard <strong>only when payment is done</strong>.
                  </span>
                </div>
              </motion.div>
            )}

            {step === 3.5 && (
              <motion.div key="step3_5" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex flex-col items-center text-center py-2">
                
                {/* Error Banner if verification failed */}
                {errorMessage && (
                  <div className="w-full mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-left flex items-start gap-2">
                    <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                    <span className="text-xs font-bold text-red-800">{errorMessage}</span>
                  </div>
                )}

                {!isMobile ? (
                  /* ─── LAPTOP VIEW: DYNAMIC QR CODE WITH STRICT VERIFICATION GATE ─── */
                  <>
                    <div className="qr-frame-wrapper mb-2">
                      <img 
                        src={qrUrl} 
                        alt="Bank Payment QR" 
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

                    {/* Pre-filled & Non-Editable Amount Banner */}
                    <div className="bg-slate-50 p-2.5 rounded-2xl w-full flex justify-between items-center my-1.5 border border-solid border-slate-100">
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Exact Locked Total</span>
                        <span className="text-xs text-green-700 font-bold">Non-Editable</span>
                      </div>
                      <span className="text-2xl font-black text-[#E4002B]">₹{totalCartValue}</span>
                    </div>

                    {/* Step 2: UPI Reference / UTR Entry */}
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

                    {/* Verification Action Button */}
                    <div className="w-full mt-2">
                      <button 
                        onClick={handleVerifyAndConfirmPayment}
                        disabled={isVerifying}
                        style={{
                          width: '100%',
                          padding: '14px',
                          background: isVerifying ? '#94A3B8' : 'linear-gradient(135deg, #16A34A, #15803D)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '14px',
                          fontWeight: 800,
                          fontSize: '1rem',
                          fontFamily: "var(--font-heading, 'Oswald', sans-serif)",
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          cursor: isVerifying ? 'not-allowed' : 'pointer',
                          boxShadow: '0 6px 18px rgba(22, 163, 74, 0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                        className="tap-effect"
                      >
                        {isVerifying ? (
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
                  /* ─── MOBILE VIEW: REDIRECTION & VERIFICATION ─── */
                  <div className="w-full flex flex-col items-center py-2">
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'rgba(30, 64, 175, 0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#1E40AF', marginBottom: 12
                    }}>
                      <Smartphone size={32} />
                    </div>

                    <h3 className="font-bold text-navy-900 text-lg mb-1">Redirected to Payment App</h3>
                    <p className="text-xs text-slate-500 font-medium px-4 mb-3">
                      Your UPI app was opened with the pre-filled, non-editable amount of <strong>₹{totalCartValue}</strong> for account <strong>{SHOP_PAYMENT_CONFIG.phone}</strong>.
                    </p>

                    <div className="bg-slate-50 p-2.5 rounded-2xl w-full flex justify-between items-center mb-3 border border-solid border-slate-100">
                      <div className="text-left">
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Payable Amount</span>
                        <span className="text-xs text-blue-700 font-bold">Non-Editable</span>
                      </div>
                      <span className="text-2xl font-black text-[#E4002B]">₹{totalCartValue}</span>
                    </div>

                    <button 
                      onClick={handleLaunchUpiAppAgain}
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

                    {/* UTR entry on mobile */}
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

                    {/* Mobile Verify Button */}
                    <div className="w-full mt-1">
                      <button 
                        onClick={handleVerifyAndConfirmPayment}
                        disabled={isVerifying}
                        style={{
                          width: '100%',
                          padding: '14px',
                          background: isVerifying ? '#94A3B8' : 'linear-gradient(135deg, #16A34A, #15803D)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '14px',
                          fontWeight: 800,
                          fontSize: '1rem',
                          fontFamily: "var(--font-heading, 'Oswald', sans-serif)",
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          cursor: isVerifying ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}
                        className="tap-effect shadow-md"
                      >
                        {isVerifying ? (
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

                {/* Cancel / Incomplete Action */}
                <div className="w-full mt-2">
                  <button 
                    onClick={handlePaymentIncomplete}
                    disabled={isVerifying}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'none',
                      border: '1px solid #E2E8F0',
                      color: '#DC2626',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Payment Incomplete / Cancel Order
                  </button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div key="step4" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="success-state py-8 flex flex-col gap-3 items-center">
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={48} color="white" /> 
                </div>
                <h3 className="heading-2 text-white text-center w-full" style={{ fontSize: '1.6rem', margin: 0 }}>Payment Verified!</h3>
                {placedOrderId && (
                  <div style={{ background: 'rgba(255,255,255,0.25)', padding: '6px 20px', borderRadius: '20px', fontWeight: 900, color: 'white', letterSpacing: '1px', fontSize: '1.1rem' }}>
                    ORDER ID: #{placedOrderId}
                  </div>
                )}
                <span className="text-white text-xs opacity-90 text-center font-bold">
                  Order confirmed and dispatched to kitchen dashboard. Redirecting to receipt...
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {step < 3.5 && (
          <div className="drawer-footer-v20">
            <motion.button 
              whileTap={{ scale: 0.97 }}
              className="pay-btn-v20 shadow-lg"
              onClick={handleProceedToPayment}
            >
              {step < 3 ? 'Continue' : `Proceed to Pay ₹${totalCartValue}`} 
              <ArrowRight size={20} className="ml-2" />
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default CheckoutDrawer;
