import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag, CreditCard, ChevronLeft } from 'lucide-react';
import './pages.css';
import './cart.css';

const CartPage = () => {
  const { cart, addToCart, removeFromCart, totalPrice, totalItems, clearCart } = useCart();
  const navigate = useNavigate();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [diningMode, setDiningMode] = useState('dine_in');
  const [paymentMode, setPaymentMode] = useState('upi');

  const cartItems = Object.values(cart);

  const handleCheckout = () => {
    setIsCheckingOut(true);
    setTimeout(() => {
      // Create a new order object
      const newOrder = {
        id: `SGU-${Math.floor(1000 + Math.random() * 9000)}`,
        status: paymentMode === 'cash' ? 'pending_cash' : 'prep',
        total: totalPrice,
        items: cartItems.map(item => `${item.quantity}x ${item.name}`).join(', '),
        stallId: cartItems[0]?.stallId || 'general',
        stallName: cartItems[0]?.stallName || 'Food Court',
        time: 'Just now',
        img: cartItems[0]?.img || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80',
        timestamp: new Date().toISOString(),
        type: diningMode === 'dine_in' ? 'Dine-In' : 'Takeaway',
        payment: paymentMode === 'upi' ? 'Online UPI' : 'Cash'
      };

      // Save to localStorage
      const existingOrders = JSON.parse(localStorage.getItem('sgu_orders') || '[]');
      localStorage.setItem('sgu_orders', JSON.stringify([newOrder, ...existingOrders]));

      navigate('/student/orders');
      clearCart();
    }, 2000);
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
    </div>
  );
};

export default CartPage;
