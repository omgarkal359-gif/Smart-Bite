import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Leaf, Flame, Pizza, Coffee, Sandwich, Utensils, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '../context/CartContext';
import { api } from '../api';
import { getItemsByStall, SHOPS, ALL_FOOD_ITEMS } from '../data/foodCourtDB';
import './pages.css';
import './menu_v21.css';

const CAT_ICONS = {
  'Pizzas': <Pizza size={16} />,
  'Burgers': <Sandwich size={16} />,
  'Beverages': <Coffee size={16} />,
  "Idli's": <Utensils size={16} />,
  "Dosa's": <Flame size={16} />,
  "Paratha's": <Flame size={16} />,
  "Pasta's": <Utensils size={16} />
};

const defaultImages = {
  'Pizzas': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80',
  'Burgers': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80',
  'Beverages': 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
  'Misal': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
  'Thalipeeth': 'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
  'Rice': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
  'Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
  "Idli's": 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
  "Dosa's": 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
  'default': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80'
};

const getFoodImage = (item) => {
  if (item && item.img && typeof item.img === 'string' && item.img.trim().startsWith('http')) return item.img;
  return defaultImages[item?.category] || defaultImages['default'];
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const targetCategory = searchParams.get('category');

  const { cart, addToCart, removeFromCart, totalItems, setIsCheckoutOpen } = useCart();

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

  // Load latest data asynchronously from API/Supabase without blocking initial render
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
    return () => { isMounted = false; };
  }, [shopId]);

  // Keep active category synced if CATEGORIES change or targetCategory updates
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
    if (highlightId) {
      setTimeout(() => {
        const el = document.getElementById(`dish-${highlightId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.border = '2px solid #E4002B';
          el.style.transform = 'scale(1.02)';
          el.style.boxShadow = '0 10px 25px rgba(228, 0, 43, 0.2)';
          setTimeout(() => {
            el.style.border = '';
            el.style.transform = '';
            el.style.boxShadow = '';
          }, 2000);
        }
      }, 400);
    }
  }, [highlightId, activeCategory]);

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
    <div className="menu-container page-transition" style={{ minHeight: '100vh', background: '#F8FAFC', paddingBottom: 100 }}>
      {/* Menu Top Bar */}
      <header className="menu-header-v21" style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '16px', sticky: 'top', top: 60, zIndex: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <button 
            onClick={() => navigate('/student')}
            style={{ background: '#F1F5F9', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ArrowLeft size={20} color="#0F172A" />
          </button>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', margin: 0, textTransform: 'capitalize', letterSpacing: '-0.02em' }}>
              {stallInfo?.name || shopId?.replace(/-/g, ' ')}
            </h1>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, fontWeight: 600 }}>
              {stallInfo?.category || 'Fresh & Hot Campus Food'}
            </p>
          </div>
        </div>
        
        {/* Category Scroll Bar */}
        <div className="category-scroll-wrapper" style={{ display: 'flex', overflowX: 'auto', gap: 8, paddingTop: 4, paddingBottom: 4 }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`category-pill-v21 tap-effect ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '8px 16px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 700,
                border: activeCategory === cat ? 'none' : '1px solid #E2E8F0',
                background: activeCategory === cat ? '#E4002B' : '#FFFFFF',
                color: activeCategory === cat ? '#FFFFFF' : '#475569',
                cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              {CAT_ICONS[cat] || <Flame size={14} />}
              <span>{cat}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Menu Food Grid */}
      <main className="menu-grid-v21" style={{ padding: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
        {filteredInventory.map((item, index) => {
          const isImgError = imgErrors[item.id];
          return (
            <div
              key={item.id || `dish-${index}`}
              id={`dish-${item.id}`}
              className={`food-card-v21 shadow-sm ${item.stock === 0 ? 'out-of-stock' : ''}`}
              style={{
                background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0',
                overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative'
              }}
            >
              <div className="food-img-wrapper-v21" style={{ width: '100%', height: 140, background: '#F1F5F9', position: 'relative', overflow: 'hidden' }}>
                {!isImgError ? (
                  <img 
                    src={getFoodImage(item)} 
                    alt={item.name} 
                    className="food-hd-img" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={() => {
                      setImgErrors(prev => ({ ...prev, [item.id]: true }));
                    }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', color: '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {getFallbackIcon(item.category)}
                  </div>
                )}

                {/* Floating Add / Qty Controller */}
                {cart[item.id] ? (
                  <div className="qty-controls-v21 shadow-md" style={{ position: 'absolute', bottom: 8, right: 8, background: '#FFFFFF', borderRadius: 20, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #E4002B' }}>
                    <button className="qty-btn" onClick={() => handleRemoveFromCartClick(item)} style={{ background: '#E4002B', color: '#FFF', border: 'none', borderRadius: '50%', width: 22, height: 22, fontWeight: 800, cursor: 'pointer' }}>-</button>
                    <span className="qty-value" style={{ fontWeight: 800, color: '#E4002B', fontSize: '0.85rem' }}>{cart[item.id].quantity}</span>
                    <button className="qty-btn" onClick={() => handleAddToCartClick(item)} disabled={item.stock === 0} style={{ background: '#E4002B', color: '#FFF', border: 'none', borderRadius: '50%', width: 22, height: 22, fontWeight: 800, cursor: 'pointer' }}>+</button>
                  </div>
                ) : (
                  <button
                    className="kfc-add-btn"
                    onClick={() => handleAddToCartClick(item)}
                    disabled={item.stock === 0}
                    style={{ position: 'absolute', bottom: 8, right: 8, width: 32, height: 32, borderRadius: 8, background: '#E4002B', color: '#FFFFFF', border: 'none', fontWeight: 800, fontSize: '1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(228, 0, 43, 0.3)' }}
                  >
                    +
                  </button>
                )}
              </div>

              <div className="food-info-v21" style={{ padding: '12px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0', lineHeight: 1.2 }}>{item.name}</h3>
                <p className="food-desc-v21" style={{ fontSize: '0.75rem', color: '#64748B', margin: '0 0 8px 0', lineHeight: 1.3 }}>Freshly prepared {item.name}.</p>

                <div className="food-bottom-row" style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p className="price-v21" style={{ fontSize: '1rem', fontWeight: 900, color: '#0F172A', margin: 0 }}>₹{item.price}</p>
                </div>
              </div>
            </div>
          );
        })}
      </main>

      {/* Floating Cart Indicator */}
      {totalItems > 0 && (
        <div
          className="floating-cart-v21"
          style={{ position: 'fixed', bottom: 80, left: 16, right: 16, background: '#0F172A', color: '#FFFFFF', borderRadius: 16, padding: '12px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 60, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}
        >
          <div className="cart-summary-v21">
            <span className="cart-total" style={{ color: '#FFFFFF', fontWeight: 800, fontSize: '0.95rem' }}>
              {totalItems} item{totalItems > 1 ? 's' : ''} added
            </span>
          </div>
          <button 
            className="checkout-btn-v21 tap-effect shadow-md" 
            onClick={() => setIsCheckoutOpen(true)}
            style={{ background: '#E4002B', color: '#FFFFFF', padding: '8px 18px', borderRadius: 10, border: 'none', fontWeight: 800, cursor: 'pointer' }}
          >
            Checkout
          </button>
        </div>
      )}
    </div>
  );
};

export default InteractiveMenu;
