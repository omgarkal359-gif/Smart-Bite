import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Leaf, Flame, Pizza, Coffee, Sandwich, WifiOff, Utensils } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { api, socket } from '../api';
import { supabase } from '../supabaseClient';
import { SHOPS } from '../data/foodCourtDB';
import { getFoodItemImage } from '../utils/imageHelper';
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

  const { cart, addToCart, removeFromCart, clearCart, totalItems, isCheckoutOpen, setIsCheckoutOpen } = useCart();

  const [inventory, setInventory] = useState([]);
  const [stallInfo, setStallInfo] = useState({ id: shopId, name: shopId ? shopId.replace(/-/g, ' ').toUpperCase() : 'SHOP MENU', category: 'Food Court Stall' });
  const [imgErrors, setImgErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Derive CATEGORIES dynamically from current inventory
  const CATEGORIES = useMemo(() => {
    const cats = inventory.map(item => item.category).filter(Boolean);
    const unique = [...new Set(cats)];
    return unique.length > 0 ? unique : ['All Items'];
  }, [inventory]);

  // Determine active category
  const [activeCategory, setActiveCategory] = useState('All Items');

  useEffect(() => {
    if (CATEGORIES.length > 0) {
      const decodedTarget = targetCategory ? decodeURIComponent(targetCategory) : null;
      if (decodedTarget && CATEGORIES.includes(decodedTarget)) {
        setActiveCategory(decodedTarget);
      } else if (!CATEGORIES.includes(activeCategory)) {
        setActiveCategory(CATEGORIES[0]);
      }
    }
  }, [CATEGORIES, targetCategory]);

  // Load latest data asynchronously from API/Supabase
  useEffect(() => {
    let isMounted = true;
    async function loadStallMenu() {
      setIsLoading(true);
      try {
        const items = await api.getStallMenu(shopId);
        if (isMounted) {
          setInventory(Array.isArray(items) ? items : []);
        }
      } catch (err) {
        console.error('Async menu load error:', err);
        if (isMounted) setInventory([]);
      } finally {
        if (isMounted) setIsLoading(false);
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

    // Socket realtime listener (legacy local-server mode)
    socket.emit('join', `stall-menu-${shopId}`);
    const handleMenuItemUpdate = (updatedItem) => {
      if (isMounted) {
        setInventory(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
      }
    };

    const handleStallStatusUpdate = (updatedStall) => {
      const targetId = updatedStall?.id || updatedStall?.stallId;
      if (isMounted && targetId && String(targetId) === String(shopId)) {
        setStallInfo(prev => ({ ...prev, ...updatedStall }));
      }
    };

    const handleCustomStallUpdate = (e) => {
      const data = e?.detail;
      const targetId = data?.id || data?.stallId;
      if (isMounted && targetId && String(targetId) === String(shopId)) {
        setStallInfo(prev => ({ ...prev, ...data }));
      }
    };

    window.addEventListener('sgu:stall_status_updated', handleCustomStallUpdate);
    window.addEventListener('storage', () => {
      api.getStalls().then(stalls => {
        if (isMounted && stalls) {
          const s = stalls.find(x => String(x.id) === String(shopId));
          if (s) setStallInfo(s);
        }
      });
    });

    socket.on('menu_item_update', handleMenuItemUpdate);
    socket.on('stall_status_update', handleStallStatusUpdate);

    // --- Supabase Realtime: listen for stall status changes ---
    const stallBroadcastChannel = supabase
      .channel(`stall-status-${shopId}`)
      .on('broadcast', { event: 'stall_status_changed' }, (payload) => {
        if (isMounted && payload?.payload) {
          setStallInfo(prev => ({ ...prev, ...payload.payload }));
        }
      })
      .subscribe();

    const globalBroadcastChannel = supabase
      .channel('global-stall-broadcasts')
      .on('broadcast', { event: 'stall_status_changed' }, (payload) => {
        const data = payload?.payload;
        const targetId = data?.id || data?.stallId;
        if (isMounted && targetId && String(targetId) === String(shopId)) {
          setStallInfo(prev => ({ ...prev, ...data }));
        }
      })
      .subscribe();

    // Polling fallback: re-fetch stall status every 3 seconds
    const pollInterval = setInterval(async () => {
      try {
        const stalls = await api.getStalls();
        if (isMounted && stalls && Array.isArray(stalls)) {
          const stall = stalls.find(s => String(s.id) === String(shopId));
          if (stall) setStallInfo(stall);
        }
      } catch (_) {
        // silent
      }
    }, 3000);

    return () => {
      isMounted = false;
      socket.off('menu_item_update', handleMenuItemUpdate);
      socket.off('stall_status_update', handleStallStatusUpdate);
      window.removeEventListener('sgu:stall_status_updated', handleCustomStallUpdate);
      supabase.removeChannel(stallBroadcastChannel);
      supabase.removeChannel(globalBroadcastChannel);
      clearInterval(pollInterval);
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

  // Derive isOnline — strictly check for offline values (0, false, "0", "false")
  const isOnline = Boolean(
    stallInfo &&
    stallInfo.online !== 0 &&
    stallInfo.online !== false &&
    stallInfo.online !== '0' &&
    stallInfo.online !== 'false' &&
    stallInfo.online !== undefined &&
    stallInfo.online !== null &&
    stallInfo.status !== 'OFFLINE' &&
    stallInfo.status !== 'CLOSED'
  );

  // Auto-clear cart when shop goes offline
  useEffect(() => {
    if (!isOnline && totalItems > 0) {
      clearCart();
    }
  }, [isOnline, totalItems, clearCart]);

  const handleAddToCartClick = (item) => {
    if (item.stock > 0 && isOnline) {
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
        {/* ── Shop Closed Banner ── */}
        {!isOnline && (
          <div className="closed-banner-v21 shadow-lg">
            <WifiOff size={24} className="text-white animate-bounce" />
            <div className="flex flex-col">
              <span className="font-extrabold uppercase tracking-wider text-sm">Shop is Temporarily Closed</span>
              <span className="text-xs opacity-90">This shop is not accepting orders right now. Please browse other active spots.</span>
            </div>
          </div>
        )}

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
                        src={getFoodItemImage(item)} 
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
                        <motion.button whileTap={{ scale: 0.9 }} className="qty-btn" onClick={() => handleAddToCartClick(item)} disabled={item.stock === 0 || !isOnline}>
                          +
                        </motion.button>
                      </div>
                    ) : (
                      <motion.button
                        whileTap={{ scale: 0.8 }}
                        className="kfc-add-btn"
                        onClick={() => handleAddToCartClick(item)}
                        disabled={item.stock === 0 || !isOnline}
                        style={!isOnline ? { background: '#94A3B8', cursor: 'not-allowed', fontSize: '0.75rem', width: 'auto', padding: '0 8px' } : {}}
                      >
                        {isOnline ? '+' : 'Closed'}
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

    </div>
  );
};

export default InteractiveMenu;
