import React from 'react';
import { useCart } from '../context/CartContext';

const CartItem = ({ item }) => {
  const { increaseQuantity, decreaseQuantity } = useCart();

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '1rem 0',
      borderBottom: '1px solid #f0f0f0'
    }}>
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{item.name}</h4>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>
          ₹{(item.price * item.quantity).toFixed(2)}
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          background: 'var(--bg-color)',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid #ddd'
        }}>
          <button 
            onClick={() => decreaseQuantity(item.id)} 
            style={{ 
              border: 'none', background: 'transparent', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem'
            }}
          >
            -
          </button>
          <span style={{ fontWeight: '600', padding: '0 0.5rem' }}>{item.quantity}</span>
          <button 
            onClick={() => increaseQuantity(item.id)} 
            style={{ 
              border: 'none', background: 'transparent', padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem'
            }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartItem;
