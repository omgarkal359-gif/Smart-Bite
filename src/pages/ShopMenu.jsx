import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { shopsData, foodItemsData } from '../data';
import { useCart } from '../context/CartContext';

const ShopMenu = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { cart, cartTotal, addToCart } = useCart();

  const shop = shopsData.find(s => s.id === id);
  const menuItems = foodItemsData.filter(item => item.shopId === id);

  const totalCartItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  if (!shop) {
    return (
      <div className="page-container" style={{ textAlign: 'center', marginTop: '4rem' }}>
        <h2>Shop not found</h2>
        <button onClick={() => navigate('/shops')} className="btn btn-primary" style={{ marginTop: '1rem' }}>Back to Shops</button>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: totalCartItems > 0 ? '80px' : '0' }}>
      
      {/* Top Banner Area */}
      <div style={{ position: 'relative' }}>
        <button 
          onClick={() => navigate('/shops')}
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            background: 'rgba(255,255,255,0.9)',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}
        >
          ← Back
        </button>
        <div style={{ width: '100%', height: '250px', backgroundColor: '#f8f9fa' }}>
          <img 
            src={shop.image} 
            alt={shop.name} 
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} 
            onError={(e) => {
              e.target.onerror = null; 
              e.target.src = 'https://placehold.co/800x400/eee/999?text=' + encodeURIComponent(shop.name);
            }}
          />
        </div>
      </div>

      <div className="page-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '1rem' }}>
        
        {/* Shop Info Header */}
        <div style={{ marginBottom: '2rem', borderBottom: '2px dashed #eee', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h1 style={{ fontSize: '2rem', margin: 0 }}>{shop.name}</h1>
            <div style={{ background: '#4caf50', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '8px', fontWeight: 'bold' }}>
              ⭐ {shop.rating}
            </div>
          </div>
          <p style={{ color: 'var(--text-light)', fontSize: '1.1rem', marginTop: '0.5rem' }}>
            {shop.description} • {shop.isOpen ? <span style={{color: '#4caf50', fontWeight: 'bold'}}>Open</span> : <span style={{color: '#d93025', fontWeight: 'bold'}}>Closed</span>}
          </p>
        </div>

        {/* Menu Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {menuItems.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f0f0f0', paddingBottom: '1.5rem' }}>
              
              <div style={{ flex: 1, paddingRight: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {item.image && <span>{item.image}</span>} {item.name}
                </h3>
                <p style={{ fontWeight: 'bold', margin: '0.3rem 0', color: 'var(--text-main)' }}>₹{item.price}</p>
                <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', margin: 0 }}>{item.description}</p>
              </div>

              <div>
                <button 
                  onClick={() => addToCart(item)}
                  style={{
                    background: 'white',
                    border: '1px solid var(--primary)',
                    color: 'var(--primary)',
                    fontWeight: 'bold',
                    padding: '0.4rem 1.2rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 5px rgba(255, 71, 87, 0.1)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => { e.target.style.background = 'var(--primary)'; e.target.style.color = 'white'; }}
                  onMouseOut={(e) => { e.target.style.background = 'white'; e.target.style.color = 'var(--primary)'; }}
                >
                  [+] ADD
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>

      {/* Floating Cart Button */}
      {totalCartItems > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '90%',
          maxWidth: '600px',
          background: 'var(--primary)',
          color: 'white',
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 10px 25px rgba(255, 71, 87, 0.4)',
          cursor: 'pointer',
          zIndex: 100
        }} onClick={() => navigate('/cart')}>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
            🛒 {totalCartItems} {totalCartItems === 1 ? 'item' : 'items'}
          </div>
          <div style={{ fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            View Cart • ₹{cartTotal.toFixed(2)} <span style={{fontSize: '1.2rem'}}>→</span>
          </div>
        </div>
      )}

    </div>
  );
};

export default ShopMenu;
