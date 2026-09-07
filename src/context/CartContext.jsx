/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Info, AlertCircle, ShoppingBag } from 'lucide-react';

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
  const [toast, setToast] = useState(null); // { message, type: 'success' | 'info' | 'error' }

  useEffect(() => {
    try {
      localStorage.setItem('sgu_cart', JSON.stringify(cart || {}));
    } catch (e) {}
  }, [cart]);

  const showToast = (message, type = 'success', duration = 3200) => {
    if (!message) return;
    setToast({ message, type });
    if (window.globalToastTimer) clearTimeout(window.globalToastTimer);
    window.globalToastTimer = setTimeout(() => {
      setToast(null);
    }, duration);
  };

  const addToCart = (item, notify = true) => {
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
    if (notify) {
      showToast(`Added ${item.name} to cart! 🛒`, 'success');
    }
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
    <CartContext.Provider value={{ cart: safeCart, addToCart, removeFromCart, clearCart, totalItems, totalPrice, isCheckoutOpen, setIsCheckoutOpen, showToast, toast }}>
      {children}

      {/* Global Center-Screen Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -30, scale: 0.88, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, y: -20, scale: 0.9, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            style={{
              position: 'fixed',
              top: '28px',
              left: '50%',
              zIndex: 99999,
              pointerEvents: 'none'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              background: 'rgba(15, 23, 42, 0.94)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: toast.type === 'error' ? '1px solid rgba(239, 68, 68, 0.4)' : toast.type === 'info' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(34, 197, 94, 0.4)',
              borderRadius: '999px',
              padding: '12px 24px',
              boxShadow: toast.type === 'error' ? '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.2)' : '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 30px rgba(34, 197, 94, 0.25)',
              color: '#FFFFFF',
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: '0.92rem',
              fontWeight: 700,
              letterSpacing: '0.01em',
              whiteSpace: 'nowrap'
            }}>
              {toast.type === 'error' ? (
                <AlertCircle size={20} color="#EF4444" />
              ) : toast.type === 'info' ? (
                <Info size={20} color="#38BDF8" />
              ) : (
                <CheckCircle2 size={20} color="#34D399" />
              )}
              <span>{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </CartContext.Provider>
  );
};
