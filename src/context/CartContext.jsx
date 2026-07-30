/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem('sgu_cart');
      const parsed = savedCart ? JSON.parse(savedCart) : {};
      return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    } catch (e) {
      return {};
    }
  });
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('sgu_cart', JSON.stringify(cart || {}));
    } catch (e) {}
  }, [cart]);

  const addToCart = (item) => {
    if (!item || !item.id) return;
    setCart(prev => {
      const safePrev = (prev && typeof prev === 'object' && !Array.isArray(prev)) ? prev : {};
      return {
        ...safePrev,
        [item.id]: {
          ...item,
          quantity: ((safePrev[item.id]?.quantity) || 0) + 1
        }
      };
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const safePrev = (prev && typeof prev === 'object' && !Array.isArray(prev)) ? prev : {};
      const newCart = { ...safePrev };
      if (newCart[itemId]) {
        if (newCart[itemId].quantity > 1) {
          newCart[itemId].quantity -= 1;
        } else {
          delete newCart[itemId];
        }
      }
      return newCart;
    });
  };

  const clearCart = () => {
    setCart({});
    try {
      localStorage.removeItem('sgu_cart');
    } catch (e) {}
  };

  const safeCart = (cart && typeof cart === 'object' && !Array.isArray(cart)) ? cart : {};
  const totalItems = Object.values(safeCart).reduce((sum, item) => sum + (item?.quantity || 0), 0);
  const totalPrice = Object.values(safeCart).reduce((sum, item) => sum + ((item?.price || 0) * (item?.quantity || 0)), 0);

  return (
    <CartContext.Provider value={{ cart: safeCart, addToCart, removeFromCart, clearCart, totalItems, totalPrice, isCheckoutOpen, setIsCheckoutOpen }}>
      {children}
    </CartContext.Provider>
  );
};
