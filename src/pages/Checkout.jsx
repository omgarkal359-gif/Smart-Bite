import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Helper to load Razorpay Script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

const Checkout = () => {
  const { cart, cartTotal, clearCart } = useCart();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [paymentMethod, setPaymentMethod] = useState('Online');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (cart.length === 0 && !success) {
    return (
      <div className="page-container" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <h2 style={{ color: 'var(--text-light)' }}>Your cart is empty.</h2>
        <button onClick={() => navigate('/')} className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Menu</button>
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
    setLoading(true);

    if (paymentMethod === 'Cash') {
      // Direct save for Cash on Delivery
      await saveOrderToFirestore('Pending');
    } else {
      // Razorpay Online Payment Flow
      const isScriptLoaded = await loadRazorpayScript();

      if (!isScriptLoaded) {
        alert('Razorpay SDK failed to load. Are you online?');
        setLoading(false);
        return;
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY_HERE', // Add this to your .env.local
        amount: Math.round(cartTotal * 100), // Razorpay works in subunits (e.g., paise/cents)
        currency: 'INR', // Change to INR if using Indian Rupees
        name: 'FoodieExpress',
        description: 'Order Payment',
        handler: async function (response) {
          // On Success
          await saveOrderToFirestore('Preparing', response.razorpay_payment_id);
        },
        prefill: {
          name: currentUser.displayName || 'Customer',
          email: currentUser.email,
        },
        theme: {
          color: '#ff6b6b' // Match your primary color
        }
      };

      const paymentObject = new window.Razorpay(options);
      
      paymentObject.on('payment.failed', function (response){
        alert("Payment failed: " + response.error.description);
        setLoading(false);
      });

      // Show the Razorpay Checkout form
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
    <div className="page-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h1 className="page-title">Checkout</h1>
      
      <div className="food-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>Order Summary</h3>
          {cart.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-light)' }}>
              <span>{item.quantity}x {item.name}</span>
              <span>₹{(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #eee', fontWeight: 'bold', fontSize: '1.2rem' }}>
            <span>Total</span>
            <span style={{ color: 'var(--primary)' }}>₹{cartTotal.toFixed(2)}</span>
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: '1rem' }}>Payment Method</h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={() => setPaymentMethod('Online')}
              style={{ 
                flex: 1, 
                padding: '1rem', 
                borderRadius: '8px', 
                border: `2px solid ${paymentMethod === 'Online' ? 'var(--primary)' : '#ddd'}`,
                background: paymentMethod === 'Online' ? '#ffecec' : 'transparent',
                cursor: 'pointer',
                fontWeight: 'bold',
                color: paymentMethod === 'Online' ? 'var(--primary)' : 'var(--text-main)'
              }}
            >
              💳 Online Payment
            </button>
            <button 
              onClick={() => setPaymentMethod('Cash')}
              style={{ 
                flex: 1, 
                padding: '1rem', 
                borderRadius: '8px', 
                border: `2px solid ${paymentMethod === 'Cash' ? 'var(--primary)' : '#ddd'}`,
                background: paymentMethod === 'Cash' ? '#ffecec' : 'transparent',
                cursor: 'pointer',
                fontWeight: 'bold',
                color: paymentMethod === 'Cash' ? 'var(--primary)' : 'var(--text-main)'
              }}
            >
              💵 Cash on Delivery
            </button>
          </div>
        </div>

        <button 
          onClick={handlePlaceOrder} 
          disabled={loading}
          className="btn btn-primary" 
          style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '1rem' }}
        >
          {loading ? 'Processing...' : `Place Order (₹${cartTotal.toFixed(2)})`}
        </button>
      </div>
    </div>
  );
};

export default Checkout;
