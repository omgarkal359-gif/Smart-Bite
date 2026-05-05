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
  { id: 1, title: 'CRISPY BUCKET', subtitle: 'Flat 20% OFF today only!', img: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80&fm=webp' },
  { id: 2, title: 'SPICY WINGS', subtitle: 'Buy 1 Get 1 Free', img: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?auto=format&fit=crop&w=800&q=80&fm=webp' },
  { id: 3, title: 'CHEESE BURGER', subtitle: 'Combo meal starting ₹199', img: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80&fm=webp' },
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
                <span className="text-white text-xs font-bold uppercase tracking-wider mb-1 block opacity-80 flex items-center gap-1"><Flame size={12}/> Trending Now</span>
                <h2 className="heading-1 text-white" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
                  {TRENDING_SLIDES[currentSlide].title}
                </h2>
                <p className="text-white opacity-90">{TRENDING_SLIDES[currentSlide].subtitle}</p>
              </div>
            </motion.div>
          </AnimatePresence>
          
          <div className="slide-indicators">
            {TRENDING_SLIDES.map((_, idx) => (
              <div key={idx} className={`slide-dot ${idx === currentSlide ? 'active' : ''}`} />
            ))}
          </div>
        </div>

        {/* Recent Order Tile */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="recent-order-widget"
          onClick={() => navigate('/student/orders')}
        >
          <div className="recent-order-bg" style={{ backgroundImage: `url(${MOCK_RECENT_ORDER.img})` }} />
          <div className="recent-order-overlay" />
          <div className="recent-order-content flex justify-between items-center w-full">
            <div>
              <span className="text-white text-xs font-bold uppercase tracking-wider mb-1 block opacity-80">Reorder</span>
              <h3 className="font-heading text-white text-2xl font-black">{MOCK_RECENT_ORDER.item}</h3>
              <p className="text-white text-sm opacity-90">{MOCK_RECENT_ORDER.shop}</p>
            </div>
            <button className="bg-[#E4002B] text-white rounded-full p-3 shadow-lg hover:scale-105 transition-transform animate-pulse">
              <ChevronRight size={24} />
            </button>
          </div>
        </motion.div>

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
              return (
              <motion.div
                key={shop.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, type: 'spring', stiffness: 100, damping: 15 }}
                whileHover={{ scale: 1.02 }}
                className={isHero ? "col-span-2" : "col-span-1"}
                style={isHero ? { gridColumn: 'span 2' } : {}}
              >
                <GlassCard 
                  className={`shop-card-v21 ${isHero ? 'hero' : 'square'} tap-effect shadow-sm ${!shop.online ? 'opacity-70' : ''}`}
                  onClick={() => shop.online && navigate(`/student/shop/${shop.id}`)}
                >
                  <div className="shop-img-container shadow-sm">
                    <img src={shop.img} alt={shop.name} className="shop-hd-img" />
                    {!isHero && <div className="shop-logo-badge absolute bottom-1 right-1 w-6 h-6 text-xs">{shop.logo}</div>}
                  </div>
                  
                  <div className="shop-card-right">
                    <div className="shop-header-row">
                      <h3 className="shop-name-v21" style={{ color: 'var(--text-dark)' }}>{shop.name}</h3>
                      {isHero && <span className="rating-v21">★ {shop.rating}</span>}
                    </div>
                    <p className="shop-category-v21 text-muted text-sm">{shop.category}</p>
                    
                    <div className="shop-footer-row mt-auto pt-2">
                      <span className={`flex items-center gap-1 text-xs font-bold ${shop.online ? 'text-green-600' : 'text-gray-400'}`}>
                        {shop.online ? <Wifi size={10} /> : <WifiOff size={10} />}
                        {shop.online ? 'Online' : 'Offline'}
                      </span>
                      
                      {shop.busyMode && isHero && (
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
