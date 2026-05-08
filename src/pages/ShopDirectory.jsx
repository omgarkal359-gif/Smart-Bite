import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Clock, Wifi, WifiOff, Search, ChevronRight, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SHOPS, searchFoodItems } from '../data/foodCourtDB';
import './pages.css';
import './home_v21.css';

const MOCK_SHOPS = SHOPS;

const MOCK_RECENT_ORDER = null;

const TRENDING_SLIDES = [];

const SkeletonCard = ({ isHero }) => (
  <div className={`shop-card-v21 skeleton ${isHero ? 'hero' : 'square'}`}>
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

  // Auto-scrolling Hero
  useEffect(() => {
    const slideInterval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % TRENDING_SLIDES.length);
    }, 4000);
    return () => clearInterval(slideInterval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="directory-container page-transition">
      <main className="shop-main-content pt-4">
        
        {/* Functional Search Bar */}
        {isLoading ? (
          <div className="skeleton" style={{ width: '100%', height: '60px', borderRadius: '16px', marginBottom: '24px', marginTop: '8px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite linear' }} />
        ) : (
          <div style={{ position: 'relative', marginBottom: '24px', marginTop: '8px' }}>
            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, pointerEvents: 'none', display: 'flex' }}>
              <Search color="#94A3B8" size={24} />
            </div>
            <input 
              type="text" 
              placeholder="What are you craving?" 
              style={{ 
                width: '100%', 
                padding: '16px 16px 16px 52px', 
                borderRadius: '16px', 
                border: '2px solid #E2E8F0', 
                outline: 'none', 
                fontSize: '1.1rem', 
                fontWeight: '600',
                background: 'var(--white)', 
                color: 'var(--text-dark)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.3s ease'
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
              <div className="flex flex-col gap-4 mb-8">
                <h3 className="section-title-home text-gray-500 mb-2" style={{ fontSize: '1rem' }}>
                  {results.length} result{results.length !== 1 ? 's' : ''} found
                </h3>
                {results.map((item, index) => (
                  <motion.div 
                    key={item.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <GlassCard 
                      className="shop-card-v21 tap-effect shadow-sm"
                      onClick={() => navigate(`/student/shop/${item.stallId}?highlight=${item.id}&category=${encodeURIComponent(item.category)}`)}
                    >
                      <div className="shop-card-right" style={{ padding: '8px 12px', width: '100%' }}>
                        <div className="shop-header-row">
                          <h4 className="shop-name-v21" style={{ color: 'var(--text-dark)' }}>{item.name}</h4>
                        </div>
                        <p className="shop-category-v21 text-muted">{item.stallName} · {item.category}</p>
                        <div className="shop-footer-row mt-2">
                          <span className="font-heading font-black text-xl" style={{ color: 'var(--text-dark)' }}>₹{item.price}</span>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            );
          })()
        ) : (
          <>
            {isLoading ? (
              <div className="skeleton" style={{ width: '100%', height: '200px', borderRadius: '24px', marginBottom: '24px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite linear' }} />
            ) : (
              <div className="hero-slideshow-wrapper shadow-2xl">
                <AnimatePresence>
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className="hero-slide"
                  >
                    <div 
                      className="hero-bg-image"
                      style={{ backgroundImage: `url(${TRENDING_SLIDES[currentSlide].img})` }}
                    />
                    <div className="hero-parallax-overlay" />
                    <div className="hero-parallax-content">
                      <span className="text-white text-xs font-bold uppercase tracking-wider mb-1 block flex items-center gap-1" style={{ color: 'white' }}><Flame size={12}/> Trending Now</span>
                      <h2 className="heading-1 text-white" style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: 'white' }}>
                        {TRENDING_SLIDES[currentSlide].title}
                      </h2>
                      <p className="text-white" style={{ color: 'white' }}>{TRENDING_SLIDES[currentSlide].subtitle}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
                
                <div className="slide-indicators">
                  {TRENDING_SLIDES.map((_, idx) => (
                    <div key={idx} className={`slide-dot ${idx === currentSlide ? 'active' : ''}`} />
                  ))}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="skeleton mb-4" style={{ width: '150px', height: '32px', borderRadius: '8px', background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite linear' }} />
            ) : (
              <h2 className="heading-2 section-title-home mb-4">Popular Spots</h2>
            )}

            <div className="shop-bento-grid">
              {isLoading ? (
                [1, 2, 3, 4].map((i, index) => (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.1 }} className={index === 0 ? "col-span-2" : "col-span-1"}>
                    <SkeletonCard isHero={index === 0} />
                  </motion.div>
                ))
              ) : (
                MOCK_SHOPS.map((shop, index) => {
                  const isHero = index === 0;
                  // Check real-time status from localStorage (synced with vendor)
                  const savedStatus = localStorage.getItem(`shop_status_${shop.id}`);
                  const isOnline = savedStatus ? savedStatus === 'OPEN' : shop.online;

                  return (
                  <motion.div
                    key={shop.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, type: 'spring', stiffness: 100, damping: 15 }}
                    whileHover={isOnline ? { scale: 1.02 } : {}}
                    className={isHero ? "col-span-2" : "col-span-1"}
                    style={isHero ? { gridColumn: 'span 2' } : {}}
                  >
                    <GlassCard 
                      className={`shop-card-v21 ${isHero ? 'hero' : 'square'} tap-effect shadow-2xl ${!isOnline ? 'opacity-40 grayscale pointer-events-none' : ''}`}
                      onClick={() => isOnline && navigate(`/student/shop/${shop.id}`)}
                    >
                      <div className="shop-img-container shadow-sm">
                        <img src={shop.img} alt={shop.name} className="shop-hd-img" />
                        {!isHero && <div className="shop-logo-badge absolute bottom-1 right-1 w-6 h-6 text-xs">{shop.logo}</div>}
                        {!isOnline && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                            <span className="bg-white text-black px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">Temporarily Closed</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="shop-card-right">
                        <div className="shop-header-row">
                          <h3 className="shop-name-v21" style={{ color: 'var(--text-dark)' }}>{shop.name}</h3>
                          {isHero && <span className="rating-v21">★ {shop.rating}</span>}
                        </div>
                        <p className="shop-category-v21 text-muted text-sm">{shop.category}</p>
                        
                        <div className="shop-footer-row mt-auto pt-2">
                          <span className={`flex items-center gap-1 text-xs font-bold ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
                            {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                          
                          {shop.busyMode && isHero && isOnline && (
                            <span className="flex items-center gap-1 text-xs font-bold text-[#E4002B] animate-pulse">
                              <Clock size={10} /> +{shop.waitTime}m
                            </span>
                          )}

                          <button 
                            className="bg-navy-900 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter hover:bg-accent-amber hover:text-navy-900 transition-colors z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/vendor/${shop.id}`);
                            }}
                          >
                            Dashboard
                          </button>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                )})
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ShopDirectory;
