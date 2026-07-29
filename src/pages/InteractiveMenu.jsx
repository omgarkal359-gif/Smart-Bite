import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Leaf, Flame, Pizza, Coffee, Sandwich, Utensils } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { api, socket } from '../api';
import { getItemsByStall, SHOPS, ALL_FOOD_ITEMS } from '../data/foodCourtDB';
import './pages.css';
import './menu_v21.css';

const CAT_ICONS = {
  'Pizzas': <Pizza size={16} />,
  'Burgers': <Sandwich size={16} />,
  'Beverages': <Coffee size={16} />,
  "Tea's": <Coffee size={16} />,
  'Coffee': <Coffee size={16} />,
  'Cold Beverages': <Coffee size={16} />,
  'Wadapav': <Flame size={16} />,
  'Misal': <Flame size={16} />,
  "Dosa's": <Flame size={16} />,
  "Idli's": <Utensils size={16} />,
  'Noodles': <Utensils size={16} />,
  'Shakes': <Coffee size={16} />
};

const categoryImagesMap = {
  "Tea's": 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
  'Coffee': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80',
  'Cold Beverages': 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=400&q=80',
  'Wadapav': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
  'Misal': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Thalipeeth': 'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
  'Rice': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
  'Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  "Idli's": 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
  "Dosa's": 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'Noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
  'Shakes': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
  'Mojito': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
  'default': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'
};

const getFoodImage = (item) => {
  if (item && item.img && typeof item.img === 'string' && item.img.trim().startsWith('http')) return item.img;
  return categoryImagesMap[item?.category] || categoryImagesMap['default'];
};

const getFallbackIcon = (category) => {
  switch (category) {
    case 'Pizzas':
      return <Pizza size={36} />;
    case 'Burgers':
      return <Sandwich size={36} />;
    case 'Beverages':
    case "Tea's":
    case 'Coffee':
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

  const { cart, addToCart, removeFromCart, totalItems, isCheckoutOpen, setIsCheckoutOpen } = useCart();

  // Initial state derived synchronously from foodCourtDB
  const initialItems = useMemo(() => {
    const items = getItemsByStall(shopId);
    return (items && items.length > 0) ? items : ALL_FOOD_ITEMS.slice(0, 20);
  }, [shopId]);

  const initialStall = useMemo(() => {
    const found = SHOPS.find(s => s.id === shopId);
    if (found) return found;
    return { id: shopId, name: shopId ? shopId.replace(/-/g, ' ').toUpperCase() : 'SHOP MENU', category: 'Food Court Stall' };
  }, [shopId]);

  const [inventory, setInventory] = useState(initialItems);
  const [stallInfo, setStallInfo] = useState(initialStall);
  const [imgErrors, setImgErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  // Sync inventory if shopId changes
  useEffect(() => {
    const items = getItemsByStall(shopId);
    if (items && items.length > 0) {
      setInventory(items);
    }
    const found = SHOPS.find(s => s.id === shopId);
    if (found) setStallInfo(found);
  }, [shopId]);

  // Derive CATEGORIES dynamically from current inventory
  const CATEGORIES = useMemo(() => {
    const cats = inventory.map(item => item.category).filter(Boolean);
    const unique = [...new Set(cats)];
    return unique.length > 0 ? unique : ['All Items'];
  }, [inventory]);

  // Determine active category
  const [activeCategory, setActiveCategory] = useState(() => {
    const decodedTarget = targetCategory ? decodeURIComponent(targetCategory) : null;
    const initialCats = initialItems.map(i => i.category).filter(Boolean);
    const unique = [...new Set(initialCats)];
    if (decodedTarget && unique.includes(decodedTarget)) return decodedTarget;
    return unique[0] || 'All Items';
  });

  // Load latest data asynchronously from API/Supabase
  useEffect(() => {
    let isMounted = true;
    async function loadStallMenu() {
      try {
        const items = await api.getStallMenu(shopId);
        if (isMounted && items && Array.isArray(items) && items.length > 0) {
          setInventory(items);
        }
      } catch (err) {
        console.error('Async menu load error:', err);
      }

      try {
        const stalls = await api.getStalls();
        if (isMounted && stalls && Array.isArray(stalls)) {
          const stall = stalls.find(s => s.id === shopId);
          if (stall) setStallInfo(stall);
        }
      } catch (err) {
        console.error('Async stall load error:', err);
      }
    }
    loadStallMenu();

    // Socket realtime listener
    socket.emit('join', `stall-menu-${shopId}`);
    const handleMenuItemUpdate = (updatedItem) => {
      if (isMounted) {
        setInventory(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      }
    };
    socket.on('menu_item_update', handleMenuItemUpdate);

    return () => {
      isMounted = false;
      socket.off('menu_item_update', handleMenuItemUpdate);
    };
  }, [shopId]);

  // Keep active category synced
  useEffect(() => {
    const decodedTarget = targetCategory ? decodeURIComponent(targetCategory) : null;
    if (decodedTarget && CATEGORIES.includes(decodedTarget)) {
      setActiveCategory(decodedTarget);
    } else if (!activeCategory || !CATEGORIES.includes(activeCategory)) {
      setActiveCategory(CATEGORIES[0] || 'All Items');
    }
  }, [CATEGORIES, targetCategory]);

  // Highlight scroll
  useEffect(() => {
    if (highlightId && !isLoading) {
      setTimeout(() => {
        const el = document.getElementById(`dish-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.border = '2px solid var(--primary-color, #E4002B)';
          el.style.transform = 'scale(1.02)';
          el.style.boxShadow = '0 10px 25px rgba(228, 0, 43, 0.2)';
          setTimeout(() => {
            el.style.border = '';
            el.style.transform = '';
            el.style.boxShadow = '';
          }, 2000);
        }
      }, 300);
    }
  }, [highlightId, isLoading, activeCategory]);

  // Derive display inventory with live cart subtraction
  const displayInventory = useMemo(() => {
    return inventory.map(item => {
      const cartQty = cart[item.id]?.quantity || 0;
      const baseStock = item.stock !== undefined ? item.stock : 20;
      return {
        ...item,
        stock: Math.max(0, baseStock - cartQty)
      };
    });
  }, [inventory, cart]);

  const handleAddToCartClick = (item) => {
    if (item.stock > 0) {
      addToCart(item);
    }
  };

  const handleRemoveFromCartClick = (item) => {
    if (cart[item.id] && cart[item.id].quantity > 0) {
      removeFromCart(item.id);
    }
  };

  const filteredInventory = useMemo(() => {
    if (!activeCategory || activeCategory === 'All Items') return displayInventory;
    const matched = displayInventory.filter(item => item.category === activeCategory);
    return matched.length > 0 ? matched : displayInventory;
  }, [displayInventory, activeCategory]);

  return (
    <div className="menu-container page-transition">
      {/* KFC Style Sticky Menu Header */}
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

      {/* KFC Style Responsive Bento Menu Grid */}
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
                  key={item.id || index}
                  id={`dish-${item.id}`}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 100, damping: 15, delay: index * 0.05 }}
                  whileHover={{ y: -5 }}
                  className={`food-card-v21 shadow-sm ${item.stock === 0 ? 'out-of-stock' : ''}`}
                >
                  <div className="food-img-wrapper-v21">
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
                      <div style={{ width: '100%', height: '100%', color: '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {getFallbackIcon(item.category)}
                      </div>
                    )}

                    {/* Floating KFC Red Add/Qty Selector */}
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
                    <p className="food-desc-v21">Freshly prepared {item.name.toLowerCase()} with signature ingredients.</p>

                    <div className="food-bottom-row">
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

      {/* KFC Style Floating Bottom Cart Bar */}
      {totalItems > 0 && (
        <motion.div
          className="floating-cart-v21 shadow-2xl"
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

    </div>
  );
};

export default InteractiveMenu;
