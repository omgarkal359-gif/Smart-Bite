import React from 'react';
import { useCart } from '../context/CartContext';

const FoodCard = ({ item }) => {
  const { addToCart, cart } = useCart();
  
  const handleAddToCart = () => {
    addToCart(item);
  };

  const inCartQty = cart.find(i => i.id === item.id)?.quantity || 0;

  return (
    <div className="food-card">
      <img src={item.image} alt={item.name} className="food-image" />
      <div className="food-info">
        <h3>{item.name}</h3>
        <p>{item.description}</p>
        <div className="food-footer">
          <span className="food-price">${item.price.toFixed(2)}</span>
          <button 
            onClick={handleAddToCart}
            className="btn btn-primary"
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            {inCartQty > 0 ? `Added (${inCartQty})` : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FoodCard;
