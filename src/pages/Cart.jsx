import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import CartItem from '../components/CartItem';

// Helper to load Razorpay Script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const Cart = () => {
  const { cart, cartTotal, clearCart } = useCart();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [paymentMethod, setPaymentMethod] = useState('Cash'); // Default to Cash to match wireframe
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (cart.length === 0 && !success) {
    return (
      <div className="page-container" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <h2 style={{ color: 'var(--text-light)' }}>Your cart is empty.</h2>
        <button onClick={() => navigate('/shops')} className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Shops</button>
      </div>
    );
  }

  // Core function to save order to Firestore
  const saveOrderToFirestore = async (status, paymentId = null) => {
    try {
      const orderData = {
        userId: currentUser.uid,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        totalPrice: cartTotal,
        paymentMethod,
        status: status,
        paymentId: paymentId,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'orders'), orderData);
      setSuccess(true);
      clearCart();
    } catch (error) {
      console.error("Error saving order: ", error);
      alert("Payment successful, but failed to save order to database. Please contact support.");
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!currentUser) {
      navigate('/auth');
      return;
    }

    setLoading(true);

    if (paymentMethod === 'Cash') {
      await saveOrderToFirestore('Pending');
    } else {
      const isScriptLoaded = await loadRazorpayScript();

      if (!isScriptLoaded) {
        alert('Razorpay SDK failed to load. Are you online?');
        setLoading(false);
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE',
        amount: Math.round(cartTotal * 100),
        currency: 'INR',
        name: 'FoodieExpress',
        description: 'Order Payment',
        handler: async function (response) {
          await saveOrderToFirestore('Preparing', response.razorpay_payment_id);
        },
        prefill: {
          name: currentUser.displayName || 'Customer',
          email: currentUser.email,
        },
        theme: { color: '#ff4757' }
      };

      const paymentObject = new window.Razorpay(options);
      
      paymentObject.on('payment.failed', function (response){
        alert("Payment failed: " + response.error.description);
        setLoading(false);
      });

      paymentObject.open();
    }
  };

  if (success) {
    return (
      <div className="page-container" style={{ textAlign: 'center', maxWidth: '500px', margin: '4rem auto' }}>
        <div className="food-card" style={{ padding: '3rem 2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
          <h1 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Order Placed Successfully!</h1>
          <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>
            Thank you for your purchase. You can track your order status in the "My Orders" tab.
          </p>
          <button onClick={() => navigate('/orders')} className="btn btn-primary">
            View My Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        🛒 Your Cart
      </h1>
      
      <div className="food-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        
        {/* Cart Items */}
        <div style={{ borderTop: '2px dashed #eee', borderBottom: '2px dashed #eee', margin: '0.5rem 0' }}>
          {cart.map(item => (
            <CartItem key={item.id} item={item} />
          ))}
        </div>
        
        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.3rem', fontWeight: '800', margin: '0.5rem 0 1.5rem 0' }}>
          <span>Total:</span>
          <span style={{ color: 'var(--primary)' }}>₹{cartTotal.toFixed(2)}</span>
        </div>

        {/* Payment Method */}
        <div>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', fontSize: '1.1rem' }}>Payment Method:</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', fontSize: '1.1rem' }}>
              <input 
                type="radio" 
                name="payment" 
                value="Cash"
                checked={paymentMethod === 'Cash'}
                onChange={() => setPaymentMethod('Cash')}
                style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
              />
              Cash on Delivery
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer', fontSize: '1.1rem' }}>
              <input 
                type="radio" 
                name="payment" 
                value="Online"
                checked={paymentMethod === 'Online'}
                onChange={() => setPaymentMethod('Online')}
                style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
              />
              Online Payment
            </label>
          </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={handlePlaceOrder} 
          disabled={loading}
          className="btn btn-primary" 
          style={{ width: '100%', padding: '1.2rem', fontSize: '1.2rem', marginTop: '1.5rem', borderRadius: '12px' }}
        >
          {loading ? 'Processing...' : (!currentUser ? 'Login to Place Order' : 'Place Order')}
        </button>
      </div>
    </div>
  );
};

export default Cart;
