import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Leaf, Flame, Pizza, Coffee, Sandwich, Utensils } from 'lucide-react';
import { CheckoutDrawer } from '../components/ui/CheckoutDrawer';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { api, socket } from '../api';
import './pages.css';
import './menu_v21.css';

const CAT_ICONS = {
  'Pizzas': <Pizza size={16} />,
  'Burgers': <Sandwich size={16} />,
  'Beverages': <Coffee size={16} />
};

const defaultImages = {
  'Pizzas': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
  'Burgers': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
  'Beverages': 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
  'Misal': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Thalipeeth': 'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
  'Rice': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
  'Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  'default': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'
};

const getFoodImage = (item) => {
  if (item.img && item.img.trim().startsWith('http')) return item.img;
  return defaultImages[item.category] || defaultImages['default'];
};

const getFallbackIcon = (category) => {
  switch (category) {
    case 'Pizzas':
      return <Pizza size={36} />;
    case 'Burgers':
      return <Sandwich size={36} />;
    case 'Beverages':
      return <Coffee size={36} />;
    default:
      return <Utensils size={36} />;
  }
};

const InteractiveMenu = () => {
  const { shopId } = useParams();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const targetCategory = searchParams.get('category');

  const [activeCategory, setActiveCategory] = useState('');
  const { cart, addToCart, removeFromCart, totalItems, isCheckoutOpen, setIsCheckoutOpen, clearCart } = useCart();

  const [inventory, setInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stallInfo, setStallInfo] = useState(null);
  const [imgErrors, setImgErrors] = useState({});

  // Derive CATEGORIES dynamically from the inventory
  const CATEGORIES = useMemo(() => {
    const cats = inventory.map(item => item.category);
    return [...new Set(cats)];
  }, [inventory]);

  // Set initial category & inventory when stall loads
  useEffect(() => {
    async function loadStallMenu() {
      try {
        const items = await api.getStallMenu(shopId);
        setInventory(items);

        const stalls = await api.getStalls();
        const stall = stalls.find(s => s.id === shopId);
        setStallInfo(stall);

        const cats = [...new Set(items.map(i => i.category))];
        if (targetCategory && cats.includes(targetCategory)) {
          setActiveCategory(targetCategory);
        } else if (cats.length > 0) {
          setActiveCategory(cats[0]);
        }
      } catch (err) {
        console.error('Failed to load menu:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadStallMenu();

    // Join room for real-time menu/stock updates
    socket.emit('join', `stall-menu-${shopId}`);

    const handleMenuItemUpdate = (updatedItem) => {
      setInventory(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    };

    socket.on('menu_item_update', handleMenuItemUpdate);

    // Polling fallback
    const interval = setInterval(async () => {
      try {
        const items = await api.getStallMenu(shopId);
        setInventory(items);
        
        const stalls = await api.getStalls();
        const stall = stalls.find(s => s.id === shopId);
        if (stall) setStallInfo(stall);
      } catch (err) {
        console.error('Polling failed to fetch menu updates:', err);
      }
    }, 15000); // 15 seconds polling interval for menu updates

    return () => {
      socket.off('menu_item_update', handleMenuItemUpdate);
      clearInterval(interval);
    };
  }, [shopId, targetCategory]);

  useEffect(() => {
    if (highlightId && !isLoading) {
      setTimeout(() => {
        const el = document.getElementById(`dish-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.border = '2px solid var(--primary-color, #E4002B)';
          el.style.transform = 'scale(1.02)';
          el.style.boxShadow = '0 10px 25px rgba(228, 0, 43, 0.2)';
          el.style.transition = 'all 0.5s ease-in-out';
          setTimeout(() => {
            el.style.border = '';
            el.style.transform = '';
            el.style.boxShadow = '';
          }, 2000);
        }
      }, 300);
    }
  }, [highlightId, isLoading, activeCategory]);

  const handleAddToCartClick = (item) => {
    if (item.stock > 0) {
      addToCart(item);
      setInventory(prev => prev.map(i => i.id === item.id ? { ...i, stock: i.stock - 1 } : i));
    }
  };

  const handleRemoveFromCartClick = (item) => {
    if (cart[item.id] && cart[item.id].quantity > 0) {
      removeFromCart(item.id);
      setInventory(prev => prev.map(i => i.id === item.id ? { ...i, stock: i.stock + 1 } : i));
    }
  };

  const filteredInventory = inventory.filter(item => {
    return item.category === activeCategory;
  });

  return (
    <div className="menu-container page-transition">
      <header className="menu-header-v21">
        <h2 className="heading-2">{stallInfo ? stallInfo.name : `Shop #${shopId}`}</h2>
        
        <div className="category-scroll-wrapper mt-4">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`category-pill-v21 tap-effect ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CAT_ICONS[cat] || <Flame size={16} />}
              <span>{cat}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="menu-grid-v21">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            [1, 2, 3, 4].map(i => (
              <motion.div key={`skel-${i}`} className="food-card-v21 shadow-lg skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }}>
                <div className="skeleton-food-img" />
                <div className="p-3">
                  <div className="skeleton-text w-3/4 mb-2" />
                  <div className="skeleton-text w-1/2" />
                </div>
              </motion.div>
            ))
          ) : (
            filteredInventory.map((item, index) => {
              const isImgError = imgErrors[item.id];
              return (
                <motion.div
                  key={item.id}
                  id={`dish-${item.id}`}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15, delay: index * 0.05 }}
                  whileHover={{ y: -5 }}
                  className={`food-card-v21 shadow-sm ${item.stock === 0 ? 'out-of-stock' : ''}`}
                >
                  <div className="food-img-wrapper-v21" style={{ background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                    {!isImgError ? (
                      <img 
                        src={getFoodImage(item)} 
                        alt={item.name} 
                        className="food-hd-img" 
                        onError={() => {
                          setImgErrors(prev => ({ ...prev, [item.id]: true }));
                        }}
                      />
                    ) : (
                      <div style={{ color: '#CBD5E1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        {getFallbackIcon(item.category)}
                      </div>
                    )}

                    {/* Floating Cart Add/Qty selector inside the image wrapper */}
                    {cart[item.id] ? (
                      <div className="qty-controls-v21 shadow-md">
                        <motion.button whileTap={{ scale: 0.9 }} className="qty-btn" onClick={() => handleRemoveFromCartClick(item)}>
                          -
                        </motion.button>
                        <span className="qty-value">{cart[item.id].quantity}</span>
                        <motion.button whileTap={{ scale: 0.9 }} className="qty-btn" onClick={() => handleAddToCartClick(item)} disabled={item.stock === 0}>
                          +
                        </motion.button>
                      </div>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        className="kfc-add-btn"
                        onClick={() => handleAddToCartClick(item)}
                        disabled={item.stock === 0}
                      >
                        +
                      </motion.button>
                    )}
                  </div>

                  <div className="food-info-v21">
                    <h3>{item.name}</h3>
                    <p className="food-desc-v21">Enjoy the authentic taste of freshly prepared {item.name.toLowerCase()} with signature herbs.</p>

                    <div className="food-bottom-row" style={{ marginTop: 'auto', paddingTop: '8px' }}>
                      <p className="price-v21">₹{item.price}</p>
                    </div>

                    {item.stock > 0 && item.stock <= 5 && (
                      <span className="stock-warning mt-2 block" style={{ fontSize: '0.7rem' }}>Only {item.stock} left</span>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </main>

      {totalItems > 0 && (
        <motion.div
          className="floating-cart-v21"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
        >
          <div className="cart-summary-v21">
            <span className="cart-total">
              {totalItems} item{totalItems > 1 ? 's' : ''} added
            </span>
          </div>
          <button 
            className="checkout-btn-v21 tap-effect shadow-md" 
            onClick={() => setIsCheckoutOpen(true)}
          >
            Checkout
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {isCheckoutOpen && (
          <CheckoutDrawer 
            isOpen={isCheckoutOpen} 
            onClose={() => setIsCheckoutOpen(false)} 
            cart={cart}
            onComplete={() => {
              clearCart();
              setIsCheckoutOpen(false);
            }}
          />
        )}
      </AnimatePresence>

    </div>
  );
};

export default InteractiveMenu;
