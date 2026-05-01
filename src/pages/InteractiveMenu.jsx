import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Leaf, Flame, Pizza, Coffee, Sandwich } from 'lucide-react';
import { CheckoutDrawer } from '../components/ui/CheckoutDrawer';
import { motion, AnimatePresence } from 'framer-motion';
import './pages.css';
import './menu_v21.css';

const MOCK_INVENTORY = [
  { id: 1, name: 'Margherita Pizza', category: 'Pizzas', price: 150, stock: 10, isVeg: true, img: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=300&q=80&fm=webp' },
  { id: 2, name: 'Pepperoni Blast', category: 'Pizzas', price: 200, stock: 0, isVeg: false, img: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=300&q=80&fm=webp' },
  { id: 3, name: 'BBQ Chicken', category: 'Pizzas', price: 250, stock: 5, isVeg: false, img: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=300&q=80&fm=webp' },
  { id: 4, name: 'Classic Burger', category: 'Burgers', price: 100, stock: 15, isVeg: false, img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80&fm=webp' },
  { id: 5, name: 'Cheese Burger', category: 'Burgers', price: 120, stock: 8, isVeg: false, img: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=300&q=80&fm=webp' },
  { id: 6, name: 'Veggie Burger', category: 'Burgers', price: 110, stock: 20, isVeg: true, img: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=300&q=80&fm=webp' },
];

const CAT_ICONS = {
  'Pizzas': <Pizza size={16} />,
  'Burgers': <Sandwich size={16} />,
  'Beverages': <Coffee size={16} />
};

const CATEGORIES = [...new Set(MOCK_INVENTORY.map(item => item.category))];

const InteractiveMenu = () => {
  const { shopId } = useParams();
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0]);
  const [cart, setCart] = useState({});
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [dietFilter, setDietFilter] = useState('all');

  const [inventory, setInventory] = useState(MOCK_INVENTORY);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleAddToCart = (item) => {
    if (item.stock > 0) {
      setCart(prev => ({ ...prev, [item.id]: (prev[item.id] || 0) + 1 }));
      setInventory(prev => prev.map(i => i.id === item.id ? { ...i, stock: i.stock - 1 } : i));
    }
  };

  const handleRemoveFromCart = (item) => {
    if (cart[item.id] > 0) {
      setCart(prev => {
        const newCart = { ...prev, [item.id]: prev[item.id] - 1 };
        if (newCart[item.id] === 0) delete newCart[item.id];
        return newCart;
      });
      setInventory(prev => prev.map(i => i.id === item.id ? { ...i, stock: i.stock + 1 } : i));
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.category === activeCategory;
    const matchesDiet = dietFilter === 'all' ? true : (dietFilter === 'veg' ? item.isVeg : !item.isVeg);
    return matchesSearch && matchesDiet;
  });

  // Calculate cart
  const totalCartItems = Object.values(cart).reduce((a, b) => a + b, 0);

  // Expose global checkout via local state for this shop
  useEffect(() => {
    if (totalCartItems > 0 && !isCheckoutOpen) {
      // We could use context to trigger checkout, but let's just trigger it via floating button
    }
  }, [totalCartItems, isCheckoutOpen]);

  return (
    <div className="menu-container page-transition">
      <header className="menu-header-v21">
        <h2 className="heading-2">Shop #{shopId}</h2>

        {/* Diet Filters */}
        <div className="diet-filters mt-4">
          <button className={`diet-btn ${dietFilter === 'all' ? 'active' : ''}`} onClick={() => setDietFilter('all')}>
            All
          </button>
          <button className={`diet-btn veg ${dietFilter === 'veg' ? 'active' : ''}`} onClick={() => setDietFilter('veg')}>
            <Leaf size={14} /> Veg
          </button>
          <button className={`diet-btn non-veg ${dietFilter === 'non-veg' ? 'active' : ''}`} onClick={() => setDietFilter('non-veg')}>
            <Flame size={14} /> Non-Veg
          </button>
        </div>

        <div className="category-scroll-wrapper">
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
                        <motion.button whileTap={{ scale: 0.9 }} className="qty-btn" onClick={() => handleRemoveFromCart(item)}>
                          -
                        </motion.button>
                        <span className="qty-value">{cart[item.id]}</span>
                        <motion.button whileTap={{ scale: 0.9 }} className="qty-btn" onClick={() => handleAddToCart(item)} disabled={item.stock === 0}>
                          +
                        </motion.button>
                      </div>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        className="kfc-add-btn"
                        onClick={() => handleAddToCart(item)}
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
                      <div className="flex items-center gap-2">
                        <div className={`diet-indicator-v21 ${item.isVeg ? 'veg' : 'non-veg'}`} style={{ marginTop: 0 }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {item.isVeg ? 'Veg' : 'Non Veg'}
                        </span>
                      </div>
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

      {totalCartItems > 0 && (
        <motion.div
          className="global-cart-trigger"
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          exit={{ y: 100 }}
        >
          <button className="btn-primary-v21 tap-effect shadow-2xl" onClick={() => setIsCheckoutOpen(true)}>
            Checkout ({totalCartItems} items)
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
