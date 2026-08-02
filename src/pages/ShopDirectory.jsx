import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Clock, Wifi, WifiOff, Search, Flame, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { SHOPS, searchFoodItems } from '../data/foodCourtDB';
import { api, socket } from '../api';
import { supabase } from '../supabaseClient';
import './pages.css';
import './home_v21.css';

const MOCK_SHOPS = SHOPS;

const MOST_ORDERED_SLIDES = [
  { 
    id: 1, 
    rank: '🏆 #1 MOST ORDERED', 
    title: 'CLASSIC WADAPAV', 
    subtitle: '🔥 350+ Orders Today! Fresh & hot classic Mumbai wadapav for ₹25', 
    img: 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=800&q=80&fm=webp', 
    path: '/student/shop/rohit-vadewale?category=Wadapav' 
  },
  { 
    id: 2, 
    rank: '🏆 #2 MOST ORDERED', 
    title: 'MISAL', 
    subtitle: '🔥 280+ Orders Today! Spicy Kolhapuri special Misal for ₹50', 
    img: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=800&q=80&fm=webp', 
    path: '/student/shop/mangales-snacks?category=Misal' 
  },
  { 
    id: 3, 
    rank: '🏆 #3 MOST ORDERED', 
    title: 'MASALA DOSA', 
    subtitle: '🔥 220+ Orders Today! Crispy South Indian Special Dosa for ₹50', 
    img: 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=800&q=80&fm=webp', 
    path: "/student/shop/narayana?category=Dosa's" 
  },
  { 
    id: 4, 
    rank: '🏆 #4 MOST ORDERED', 
    title: 'COLD COFFEE', 
    subtitle: '🔥 190+ Orders Today! Rich, creamy chilled coffee for ₹50', 
    img: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80&fm=webp', 
    path: '/student/shop/cool-cravings?category=Cold%20Coffee' 
  },
  { 
    id: 5, 
    rank: '🏆 #5 MOST ORDERED', 
    title: 'HAKKA NOODLES', 
    subtitle: '🔥 160+ Orders Today! Indo-Chinese wok fried noodles for ₹50', 
    img: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80&fm=webp', 
    path: '/student/shop/oodles-of-noodles?category=Noodles' 
  }
];

const SkeletonCard = () => (
  <div className="shop-card-v21 skeleton">
    <div className="skeleton-img" />
    <div className="shop-card-right">
      <div className="skeleton-text w-3/4" />
      <div className="skeleton-text w-1/2 mt-2" />
      <div className="skeleton-text w-full mt-4" />
    </div>
  </div>
);

const ShopDirectory = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [query, setQuery] = useState('');
  const [stalls, setStalls] = useState(MOCK_SHOPS);
  const [slides] = useState(MOST_ORDERED_SLIDES);
  const carouselRef = useRef(null);

  // Auto-scrolling Hero Slideshow
  useEffect(() => {
    const slideInterval = setInterval(() => {
      setCurrentSlide(prev => {
        const next = (prev + 1) % slides.length;
        if (carouselRef.current) {
          carouselRef.current.scrollTo({
            left: carouselRef.current.clientWidth * next,
            behavior: 'smooth'
          });
        }
        return next;
      });
    }, 4500);
    return () => clearInterval(slideInterval);
  }, [slides.length]);

  const handleScroll = (e) => {
    if (!e.target) return;
    const scrollLeft = e.target.scrollLeft;
    const width = e.target.clientWidth;
    const slide = Math.round(scrollLeft / width);
    if (slide !== currentSlide) {
      setCurrentSlide(slide);
    }
  };

  useEffect(() => {
    const loadStalls = async () => {
      try {
        const data = await api.getStalls();
        if (data && data.length > 0) {
          setStalls(data);
        }
      } catch (err) {
        console.error('Failed to load stalls:', err);
        setStalls(MOCK_SHOPS);
      } finally {
        setIsLoading(false);
      }
    };
    loadStalls();

    // Listen to real-time stall updates
    const stallsChannel = supabase
      .channel('directory-stalls')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stalls' }, (payload) => {
        if (payload.eventType === 'UPDATE' && payload.new) {
          setStalls(prev => prev.map(s => String(s.id) === String(payload.new.id) ? { ...s, ...payload.new } : s));
        } else if (payload.eventType === 'INSERT' && payload.new) {
          setStalls(prev => [...prev, payload.new]);
        }
      })
      .subscribe();

    socket.emit('join', 'student');
    const handleStatusUpdate = (updatedStall) => {
      const targetId = updatedStall?.id || updatedStall?.stallId;
      if (targetId) {
        setStalls(prev => prev.map(s => String(s.id) === String(targetId) ? { ...s, ...updatedStall } : s));
      }
    };
    socket.on('stall_status_update', handleStatusUpdate);

    // Subscribe to Supabase broadcast event for real-time stall updates
    const broadcastChannel = supabase
      .channel('global-stall-broadcasts')
      .on('broadcast', { event: 'stall_status_changed' }, (payload) => {
        const data = payload?.payload;
        const targetId = data?.id || data?.stallId;
        if (targetId) {
          setStalls(prev => prev.map(s => String(s.id) === String(targetId) ? { ...s, ...data } : s));
        }
      })
      .subscribe();

    const interval = setInterval(loadStalls, 2000);

    return () => {
      supabase.removeChannel(stallsChannel);
      supabase.removeChannel(broadcastChannel);
      socket.off('stall_status_update', handleStatusUpdate);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="directory-container page-transition" style={{ paddingBottom: 110 }}>
      <main className="shop-main-content pt-2">
        
        {/* Search Bar */}
        {isLoading ? (
          <div className="skeleton" style={{ width: '100%', height: '54px', borderRadius: '16px', marginBottom: '20px' }} />
        ) : (
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, pointerEvents: 'none', display: 'flex' }}>
              <Search color="#94A3B8" size={20} />
            </div>
            <input 
              type="text" 
              placeholder="What are you craving today?" 
              style={{ 
                width: '100%', 
                padding: '14px 16px 14px 48px', 
                borderRadius: '16px', 
                border: '1.5px solid #E2E8F0', 
                outline: 'none', 
                fontSize: '1rem', 
                fontWeight: '600',
                background: '#FFFFFF', 
                color: '#0F172A',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                boxSizing: 'border-box'
              }}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        {query ? (
          (() => {
            const results = searchFoodItems(query).slice(0, 20);
            return (
              <div className="flex flex-col gap-3 mb-8">
                <h3 className="section-title-home text-gray-500 mb-2" style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                  {results.length} result{results.length !== 1 ? 's' : ''} found
                </h3>
                {results.map((item, index) => (
                  <motion.div 
                    key={item.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <GlassCard 
                      className="shop-card-v21 tap-effect shadow-sm"
                      onClick={() => navigate(`/student/shop/${item.stallId}?highlight=${item.id}&category=${encodeURIComponent(item.category)}`)}
                      style={{ cursor: 'pointer', padding: '14px', background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0' }}
                    >
                      <div className="shop-card-right" style={{ width: '100%' }}>
                        <div className="shop-header-row">
                          <h4 className="shop-name-v21" style={{ color: '#0F172A', fontSize: '1rem', fontWeight: 800 }}>{item.name}</h4>
                          <span style={{ fontWeight: 900, fontSize: '1rem', color: '#E4002B' }}>₹{item.price}</span>
                        </div>
                        <p className="shop-category-v21" style={{ color: '#64748B', fontSize: '0.8rem', marginTop: 2 }}>{item.stallName} · {item.category}</p>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            );
          })()
        ) : (
          <>
            {/* Hero Slideshow Banner */}
            {isLoading ? (
              <div className="skeleton" style={{ width: '100%', height: '180px', borderRadius: '20px', marginBottom: '24px' }} />
            ) : (
              <div style={{ position: 'relative', marginBottom: '24px' }}>
                <div 
                  className="hero-slideshow-wrapper shadow-2xl" 
                  ref={carouselRef}
                  onScroll={handleScroll}
                  style={{ 
                    display: 'flex', 
                    overflowX: 'auto', 
                    scrollSnapType: 'x mandatory', 
                    scrollBehavior: 'smooth',
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none',
                    margin: 0,
                    borderRadius: '20px'
                  }}
                >
                  {slides.map((slide, idx) => (
                    <div
                      key={idx}
                      className="hero-slide tap-effect"
                      style={{ 
                        position: 'relative', 
                        flex: '0 0 100%', 
                        scrollSnapAlign: 'start', 
                        cursor: 'pointer' 
                      }}
                      onClick={() => navigate(slide.path)}
                    >
                      <div 
                        className="hero-bg-image"
                        style={{ backgroundImage: `url(${slide.img})` }}
                      />
                      <div className="hero-parallax-overlay" />
                      <div className="hero-parallax-content">
                        <span className="text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1" style={{ color: '#FDE047' }}>
                          <Flame size={14} color="#FDE047" /> {slide.rank || '🏆 MOST ORDERED'}
                        </span>
                        <h2 className="heading-1" style={{ fontSize: 'clamp(1.4rem, 5vw, 2.2rem)', marginBottom: '0.3rem', color: '#FFFFFF', textTransform: 'uppercase', fontWeight: 900 }}>
                          {slide.title}
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>{slide.subtitle}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="slide-indicators">
                  {slides.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`slide-dot ${idx === currentSlide ? 'active' : ''}`} 
                      onClick={() => {
                        setCurrentSlide(idx);
                        if (carouselRef.current) {
                          carouselRef.current.scrollTo({
                            left: carouselRef.current.clientWidth * idx,
                            behavior: 'smooth'
                          });
                        }
                      }} 
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Section Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="heading-2 section-title-home" style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>
                Popular Campus Spots
              </h2>
            </div>

            {/* Full-Width Mobile Card Grid */}
            <div className="shop-bento-grid">
              {isLoading ? (
                [1, 2, 3, 4, 5, 6].map((i) => (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <SkeletonCard />
                  </motion.div>
                ))
              ) : (
                stalls.map((shop, index) => {
                  const isOnline = Boolean(
                    shop.online !== 0 &&
                    shop.online !== false &&
                    shop.online !== '0' &&
                    shop.online !== 'false' &&
                    shop.online !== undefined &&
                    shop.online !== null
                  );

                  return (
                    <motion.div
                      key={shop.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04, type: 'spring', stiffness: 100, damping: 15 }}
                      whileHover={isOnline ? { scale: 1.01 } : {}}
                      className="shop-card-wrapper"
                    >
                      <GlassCard 
                        className={`shop-card-v21 tap-effect ${!isOnline ? 'opacity-50 grayscale' : ''}`}
                        onClick={() => {
                          if (!isOnline) {
                            alert(`${shop.name} is currently CLOSED and not accepting orders right now.`);
                            return;
                          }
                          navigate(`/student/shop/${shop.id}`);
                        }}
                      >
                        <div className="shop-img-container shadow-sm">
                          <img src={shop.img} alt={shop.name} className="shop-hd-img" />
                          <div className="shop-logo-badge">{shop.logo}</div>
                          {!isOnline && (
                            <div className="closed-overlay">
                              <span>Closed</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="shop-card-right">
                          <div className="shop-header-row">
                            <h3 className="shop-name-v21">{shop.name}</h3>
                            <span className="rating-v21 flex items-center gap-1">
                              <Star size={11} fill="#D97706" color="#D97706" /> {shop.rating || '4.5'}
                            </span>
                          </div>
                          <p className="shop-category-v21">{shop.category}</p>
                          
                          <div className="shop-footer-row">
                            <span className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
                              <span className="status-dot-indicator" />
                              {isOnline ? 'Online' : 'Offline'}
                            </span>
                            
                            {shop.busyMode && isOnline && (
                              <span className="busy-pill">
                                <Clock size={11} /> +{shop.waitTime}m wait
                              </span>
                            )}
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  );
                })
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ShopDirectory;
