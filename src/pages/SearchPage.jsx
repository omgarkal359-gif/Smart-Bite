import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Flame, Pizza, Sandwich, Coffee } from 'lucide-react';
import { motion } from 'framer-motion';
import { GlassCard } from '../components/ui/GlassCard';
import { searchFoodItems } from '../data/foodCourtDB';
import './home_v21.css';

const SearchPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  return (
    <div className="directory-container page-transition">
      <main className="shop-main-content" style={{ paddingTop: '24px' }}>
        <h2 className="heading-2 section-title-home mb-6">Search</h2>
        
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={24} />
          <input 
            type="text" 
            placeholder="What are you craving?" 
            className="w-full pl-14 pr-4 py-4 rounded-2xl border-2 focus:outline-none transition-all text-lg font-bold"
            style={{ background: 'var(--white)', color: 'var(--text-dark)', borderColor: 'var(--glass-border)' }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {!query ? (
          <div>
            <h3 className="section-title-home text-gray-500 mb-4" style={{ fontSize: '1rem' }}>Popular Categories</h3>
            <div className="flex flex-wrap gap-3">
              <GlassCard className="tap-effect flex items-center gap-2 px-5 py-3 rounded-2xl shadow-sm border font-extrabold" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-dark)', background: 'var(--white)' }} onClick={() => setQuery('Dosa')}>
                🥞 Dosa
              </GlassCard>
              <GlassCard className="tap-effect flex items-center gap-2 px-5 py-3 rounded-2xl shadow-sm border font-extrabold" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-dark)', background: 'var(--white)' }} onClick={() => setQuery('Noodles')}>
                🍜 Noodles
              </GlassCard>
              <GlassCard className="tap-effect flex items-center gap-2 px-5 py-3 rounded-2xl shadow-sm border font-extrabold" style={{ borderColor: 'var(--glass-border)', color: 'var(--text-dark)', background: 'var(--white)' }} onClick={() => setQuery('Tea')}>
                <Coffee size={18} /> Tea & Coffee
              </GlassCard>
              <GlassCard className="tap-effect flex items-center gap-2 px-5 py-3 rounded-2xl shadow-md font-extrabold" style={{ background: 'var(--error-red)', color: 'white' }} onClick={() => setQuery('Misal')}>
                <Flame size={18} /> Misal
              </GlassCard>
            </div>
          </div>
        ) : (() => {
          const results = searchFoodItems(query).slice(0, 20);
          return (
          <div className="flex flex-col gap-4">
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
                  onClick={() => navigate(`/student/shop/${item.stallId}`)}
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
        })()}
      </main>
    </div>
  );
};

export default SearchPage;
