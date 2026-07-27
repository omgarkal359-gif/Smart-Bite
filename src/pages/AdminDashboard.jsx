import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOrders(ordersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching admin orders:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { status: newStatus });
    } catch (error) {
      console.error("Error updating status: ", error);
      alert("Failed to update status.");
    }
  };

  const totalRevenue = orders
    .filter(o => o.status !== 'Rejected')
    .reduce((acc, order) => acc + (order.totalPrice || 0), 0);
    
  const activeOrders = orders.filter(o => !['Delivered', 'Rejected'].includes(o.status)).length;

  if (loading) {
    return <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f8f9fa' }}>Loading master admin...</div>;
  }

  const renderActionButtons = (order) => {
    if (order.status === 'Pending') {
      return (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button 
            onClick={() => handleStatusChange(order.id, 'Preparing')}
            style={{ flex: 1, padding: '0.6rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Accept
          </button>
          <button 
            onClick={() => handleStatusChange(order.id, 'Rejected')}
            style={{ flex: 1, padding: '0.6rem', background: '#f8f9fa', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Reject
          </button>
        </div>
      );
    }
    if (order.status === 'Preparing') {
      return (
        <button 
          onClick={() => handleStatusChange(order.id, 'Ready')}
          style={{ width: '100%', padding: '0.6rem', marginTop: '1rem', background: '#f39c12', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Mark as Ready
        </button>
      );
    }
    if (order.status === 'Ready') {
      return (
        <button 
          onClick={() => handleStatusChange(order.id, 'Delivered')}
          style={{ width: '100%', padding: '0.6rem', marginTop: '1rem', background: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          Mark as Delivered
        </button>
      );
    }
    return null;
  };

  const NavItem = ({ id, icon, label, badge }) => (
    <div 
      onClick={() => setActiveTab(id)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.8rem 1rem',
        borderRadius: '10px',
        cursor: 'pointer',
        marginBottom: '0.5rem',
        background: activeTab === id ? 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)' : 'transparent',
        color: activeTab === id ? 'white' : 'var(--text-main)',
        fontWeight: activeTab === id ? '700' : '600',
        transition: 'all 0.2s'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      {badge && (
        <span style={{ 
          background: activeTab === id ? 'rgba(255,255,255,0.2)' : 'var(--primary)', 
          color: 'white', 
          fontSize: '0.75rem', 
          padding: '0.2rem 0.6rem', 
          borderRadius: '20px',
          fontWeight: 'bold'
        }}>
          {badge}
        </span>
      )}
    </div>
  );

  const StatCard = ({ title, value, subtext, icon, trend }) => (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      padding: '1.5rem',
      boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
      border: '1px solid #eee',
      borderTop: `4px solid ${trend ? 'var(--primary)' : '#ff6b81'}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h4 style={{ color: 'var(--text-light)', fontSize: '0.85rem', fontWeight: '700', letterSpacing: '1px', margin: 0, textTransform: 'uppercase' }}>{title}</h4>
        <div style={{ background: '#fff0f2', padding: '0.5rem', borderRadius: '8px', color: 'var(--primary)' }}>{icon}</div>
      </div>
      <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-main)', marginBottom: '0.5rem', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {trend && <span style={{ color: '#27ae60', background: '#e8f8f5', padding: '0.2rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>{trend}</span>}
        {subtext}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8f9fa', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Sidebar */}
      <aside style={{ width: '280px', background: 'white', borderRight: '1px solid #eee', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '2rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '2.5rem' }}>
            <div style={{ background: 'linear-gradient(135deg, #ff4757 0%, #ff6b81 100%)', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(255,71,87,0.3)' }}>
              🛡️
            </div>
          </div>

          <nav>
            <NavItem id="overview" icon="📱" label="Overview" />
            <NavItem id="orders" icon="🛍️" label="Orders & Shops" badge="LIVE" />
            <NavItem id="users" icon="👥" label="User Access" />
            <NavItem id="config" icon="⚙️" label="Platform Config" />
            <NavItem id="logs" icon="📊" label="System Audit Logs" badge="LOGS" />
          </nav>
        </div>
        
        <div style={{ marginTop: 'auto', padding: '1.5rem', borderTop: '1px solid #eee' }}>
          <button 
            onClick={() => navigate('/shops')}
            style={{ width: '100%', padding: '0.8rem', background: '#f8f9fa', border: '1px solid #ddd', borderRadius: '8px', fontWeight: 'bold', color: 'var(--text-main)', cursor: 'pointer' }}
          >
            ← Back to App
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '900', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '1px' }}>Platform Overview</h1>
            <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-light)', fontSize: '0.95rem' }}>Realtime metrics, revenue performance and operational logs across campus stalls.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ background: '#e8f8f5', color: '#27ae60', padding: '0.5rem 1rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '8px', height: '8px', background: '#27ae60', borderRadius: '50%' }}></div>
              FIREBASE REALTIME ACTIVE
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '30px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
              <div style={{ width: '32px', height: '32px', background: 'var(--primary)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>A</div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Administrator</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 'bold' }}>SUPER ADMIN</div>
              </div>
            </div>
          </div>
        </header>

        {/* Top Metrics Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <StatCard 
            title="Total Platform Sales" 
            value={`₹${totalRevenue.toFixed(0)}`}
            icon="💰"
            trend="↗ +18.4%"
            subtext="vs previous 24H"
          />
          <StatCard 
            title="Active Live Orders" 
            value={activeOrders}
            icon="🔔"
            subtext="Realtime socket sync"
          />
          <StatCard 
            title="Campus Vendors" 
            value="6 / 6"
            icon="🏪"
            trend="100% Online"
            subtext="All stalls active"
          />
          <StatCard 
            title="System Health & Uptime" 
            value="99.8%"
            icon="⚡"
            trend="↗ Optimal"
            subtext="Latency < 25ms"
          />
        </div>

        {/* Split View Content */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          
          {/* Trends Panel (Dummy Chart Area) */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #eee', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase' }}>Revenue & Order Volume Trend</h3>
                <p style={{ margin: '0.3rem 0 0 0', color: 'var(--text-light)', fontSize: '0.9rem' }}>Hourly distribution of sales across all campus stalls</p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', fontWeight: 'bold' }}>
                <span style={{ color: 'var(--primary)' }}>■ Revenue (₹)</span>
                <span style={{ color: '#f39c12' }}>■ Orders Count</span>
              </div>
            </div>
            
            <div style={{ height: '300px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 1rem', borderBottom: '1px dashed #eee' }}>
              {/* Fake Bar Chart */}
              {[40, 70, 30, 90, 60, 100, 50].map((h, i) => (
                <div key={i} style={{ width: '40px', height: `${h}%`, background: 'linear-gradient(to top, rgba(255,71,87,0.1), rgba(255,71,87,0.6))', borderRadius: '4px 4px 0 0', position: 'relative' }}>
                  <div style={{ position: 'absolute', bottom: '-25px', left: '50%', transform: 'translateX(-50%)', fontSize: '0.8rem', color: 'var(--text-light)' }}>{10 + i}:00</div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Activity Stream (Orders) */}
          <div style={{ background: 'white', borderRadius: '16px', padding: '1.5rem', border: '1px solid #eee', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, fontWeight: '900', fontSize: '1.2rem', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--primary)' }}>🔥</span> Live Activity Stream
              </h3>
              <span style={{ background: '#e8f8f5', color: '#27ae60', padding: '0.2rem 0.6rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 'bold' }}>REALTIME</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '500px' }}>
              {orders.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-light)', padding: '2rem 0' }}>Waiting for live activities...</div>
              ) : (
                orders.map(order => (
                  <div key={order.id} style={{ background: '#f8f9fa', borderRadius: '10px', padding: '1rem', borderLeft: `4px solid ${order.status === 'Pending' ? 'var(--primary)' : order.status === 'Ready' ? '#27ae60' : '#ddd'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Order #{order.id.slice(0,6).toUpperCase()}</span>
                      <span style={{ fontWeight: '900', color: 'var(--text-main)' }}>₹{(order.totalPrice || 0).toFixed(0)}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '0.8rem' }}>
                      {order.items?.map(i => i.name).join(', ')}
                    </div>
                    {renderActionButtons(order)}
                  </div>
                ))
              )}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
