import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Clock, Wifi, WifiOff, Search, ChevronRight, Flame } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SHOPS } from '../data/foodCourtDB';
import './pages.css';
import './home_v21.css';

const MOCK_SHOPS = SHOPS;

const MOCK_RECENT_ORDER = {
  id: 'ORD-1045',
  shop: 'Pizza Paradise',
  item: 'Margherita Pizza',
  img: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=400&q=80&fm=webp'
};

const TRENDING_SLIDES = [
  { id: 1, title: 'JUMBO MISAL', subtitle: 'Mangale\'s Snacks • The Perfect Bite!', img: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=800&q=80&fm=webp' },
  { id: 2, title: 'DAVANGIRI LONI DOSA', subtitle: 'Narayan • Authentic South Indian', img: 'https://images.unsplash.com/photo-1589301760014-d929f39ce9b1?auto=format&fit=crop&w=800&q=80&fm=webp' },
  { id: 3, title: 'HAKKA NOODLES', subtitle: 'Oodles of Noodles • Best Indo-Chinese', img: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80&fm=webp' },
];

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

  // Auto-scrolling Hero
  useEffect(() => {
    const slideInterval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % TRENDING_SLIDES.length);
    }, 4000);
    return () => clearInterval(slideInterval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="directory-container page-transition">
      <main className="shop-main-content pt-4">
        
        {/* Animated Search Widget */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="dashboard-search-widget"
          onClick={() => navigate('/student/search')}
        >
          <Search size={20} color="var(--text-muted)" />
          <span style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '1.1rem' }}>What are you craving?</span>
        </motion.div>

        {/* Auto-Scrolling Hero Slideshow */}
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


        <h2 className="heading-2 section-title-home mb-4">Popular Spots</h2>

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
              const savedStatus = localStorage.getItem(`shop_status_SHOP-0${shop.id}`);
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
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            )})
          )}
        </div>
      </main>
    </div>
  );
};

export default ShopDirectory;
