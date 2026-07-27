import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

const OrderProgress = ({ status }) => {
  const steps = ['Pending', 'Preparing', 'Ready', 'Delivered'];
  
  const getStepStatus = (stepName) => {
    const currentIndex = steps.indexOf(status);
    const stepIndex = steps.indexOf(stepName);
    
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'current';
    return 'upcoming';
  };

  const getStepIcon = (state) => {
    if (state === 'completed') return <span style={{ color: '#4caf50', fontWeight: 'bold' }}>✔</span>;
    if (state === 'current') return <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>⏳</span>;
    return <span style={{ color: '#ccc' }}>○</span>;
  };

  const getLabel = (stepName) => {
    if (stepName === 'Pending') return 'Order Placed';
    return stepName;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem', padding: '1rem', background: 'var(--bg-color)', borderRadius: '12px' }}>
      <h4 style={{ margin: 0, color: 'var(--text-light)' }}>Status:</h4>
      {steps.map(step => {
        const state = getStepStatus(step);
        return (
          <div key={step} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '1rem',
            opacity: state === 'upcoming' ? 0.5 : 1,
            fontWeight: state === 'current' ? 'bold' : 'normal',
            color: state === 'current' ? 'var(--primary)' : 'var(--text-main)'
          }}>
            <div style={{ width: '20px', textAlign: 'center' }}>
              {getStepIcon(state)}
            </div>
            <span style={{ fontSize: '1.1rem' }}>{getLabel(step)}</span>
          </div>
        );
      })}
    </div>
  );
};

const Orders = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifiedOrders, setNotifiedOrders] = useState({});

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const toggleNotification = (orderId) => {
    setNotifiedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  if (loading) {
    return <div className="page-container" style={{ textAlign: 'center', padding: '4rem' }}>Loading orders...</div>;
  }

  return (
    <div className="page-container" style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <h1 className="page-title" style={{ marginBottom: '2rem' }}>My Orders</h1>

      {orders.length === 0 ? (
        <div className="food-card" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p style={{ color: 'var(--text-light)', fontSize: '1.1rem' }}>You haven't placed any orders yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {orders.map(order => (
            <div key={order.id} className="food-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0', paddingBottom: '1rem' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  📦 Order #{order.id.slice(0, 8).toUpperCase()}
                </h3>
                <span style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1.2rem' }}>
                  ₹{(order.totalPrice || 0).toFixed(2)}
                </span>
              </div>

              {/* Items List (Collapsible visually) */}
              <div>
                <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  {order.items?.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                </p>
              </div>

              {/* Progress Tracker */}
              <OrderProgress status={order.status} />

              {/* Footer Info */}
              <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <p style={{ fontWeight: '600', color: 'var(--text-main)', margin: 0 }}>
                  Estimated Time: {order.status === 'Delivered' ? 'Completed' : '10 mins'}
                </p>
                
                {order.status !== 'Delivered' && (
                  <button 
                    onClick={() => toggleNotification(order.id)}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      background: notifiedOrders[order.id] ? '#e6f4ea' : 'transparent',
                      color: notifiedOrders[order.id] ? '#137333' : 'var(--primary)',
                      border: `2px solid ${notifiedOrders[order.id] ? '#137333' : 'var(--primary)'}`,
                      borderRadius: '12px',
                      fontWeight: 'bold',
                      fontSize: '1.1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {notifiedOrders[order.id] ? 'Notifications Enabled ✔' : 'Notify me when ready 🔔'}
                  </button>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Orders;
