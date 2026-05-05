import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Leaf, Flame, Pizza, Coffee, Sandwich } from 'lucide-react';
import { CheckoutDrawer } from '../components/ui/CheckoutDrawer';
import { motion, AnimatePresence } from 'framer-motion';
import { getItemsByStall, getCategoriesByStall, FOOD_COURT } from '../data/foodCourtDB';
import { useCart } from '../context/CartContext';
import './pages.css';
import './menu_v21.css';

const CAT_ICONS = {
  'Pizzas': <Pizza size={16} />,
  'Burgers': <Sandwich size={16} />,
  'Beverages': <Coffee size={16} />
};

const InteractiveMenu = () => {
  const { shopId } = useParams();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const targetCategory = searchParams.get('category');

  // Derive data from the food court database
  const stallItems = useMemo(() => getItemsByStall(shopId), [shopId]);
  const CATEGORIES = useMemo(() => getCategoriesByStall(shopId), [shopId]);
  const stallInfo = useMemo(() => FOOD_COURT.stalls.find(s => s.id === shopId), [shopId]);

  const [activeCategory, setActiveCategory] = useState('');
  const { cart, addToCart, removeFromCart, totalItems } = useCart();
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const [inventory, setInventory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Set initial category & inventory when stall loads
  useEffect(() => {
    if (targetCategory && CATEGORIES.includes(targetCategory)) {
      setActiveCategory(targetCategory);
    } else if (CATEGORIES.length > 0) {
      setActiveCategory(CATEGORIES[0]);
    }
    setInventory(stallItems);
  }, [shopId, CATEGORIES, stallItems, targetCategory]);

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

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

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

  // Expose global checkout via local state for this shop
  useEffect(() => {
    if (totalItems > 0 && !isCheckoutOpen) {
      // We could use context to trigger checkout, but let's just trigger it via floating button
    }
  }, [totalItems, isCheckoutOpen]);

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
              const isFeatured = index === 0;
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
                  className={`food-card-v21 shadow-sm ${item.stock === 0 ? 'out-of-stock' : ''} ${isFeatured ? 'featured' : ''}`}
                >
                  <div className="food-img-wrapper-v21">
                    <img src={item.img} alt={item.name} className="food-hd-img" />

                    {/* KFC Add Button positioned over the image */}
                    {cart[item.id] ? (
                      <div className="qty-controls-v21 shadow-md" style={{ position: 'absolute', bottom: '8px', right: '8px', zIndex: 10 }}>
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
          className="global-cart-trigger"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
        >
          <button className="btn-primary-v21 tap-effect shadow-2xl" onClick={() => setIsCheckoutOpen(true)}>
            Checkout ({totalItems} items)
          </button>
        </motion.div>
      )}

      <CheckoutDrawer
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cart={cart}
        inventory={inventory}
      />
    </div>
  );
};

export default InteractiveMenu;
