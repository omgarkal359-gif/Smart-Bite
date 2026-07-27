import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { shopsData } from '../data';

const categories = [
  { id: 'Snacks', icon: '🍟', label: 'Snacks' },
  { id: 'Drinks', icon: '🥤', label: 'Drinks' },
  { id: 'Meals', icon: '🍔', label: 'Meals' },
  { id: 'Desserts', icon: '🍰', label: 'Desserts' }
];

const Shops = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const searchQuery = searchParams.get('q') || '';
  
  const [activeCategory, setActiveCategory] = useState('');

  const filteredShops = shopsData.filter(shop => {
    const matchesCategory = activeCategory === '' || shop.category === activeCategory;
    const matchesSearch = shop.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          shop.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="page-container" style={{ padding: '1rem', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* Location Banner */}
      <div style={{ 
        display: 'inline-flex', 
        alignItems: 'center', 
        gap: '0.8rem', 
        marginBottom: '2.5rem', 
        padding: '0.6rem 1.2rem',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 100%)',
        backdropFilter: 'blur(16px)',
        borderRadius: '30px',
        color: 'var(--text-main)', 
        fontWeight: 'bold',
        boxShadow: '0 8px 32px rgba(31, 38, 135, 0.07)',
        border: '1px solid rgba(255, 255, 255, 1)'
      }}>
        <div style={{ background: '#ffeaa7', padding: '0.3rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '1.2rem' }}>📍</span> 
        </div>
        <span style={{ fontSize: '1.05rem', letterSpacing: '-0.3px' }}>Campus Location</span>
        <span style={{ 
          color: 'white', 
          background: 'var(--primary)',
          padding: '0.3rem 0.8rem',
          borderRadius: '20px',
          marginLeft: '0.5rem', 
          cursor: 'pointer', 
          fontSize: '0.8rem', 
          fontWeight: '800',
          boxShadow: '0 2px 8px rgba(255, 71, 87, 0.3)'
        }}>CHANGE</span>
      </div>

      {/* Categories Header */}
      <h3 style={{ 
        marginBottom: '1rem', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '0.6rem',
        fontSize: '1.5rem',
        fontWeight: '800',
        color: 'var(--text-main)'
      }}>
        <span style={{ fontSize: '1.6rem' }}>🔥</span> Categories
      </h3>
      
      {/* Category Pills */}
      <div className="categories-pill-container" style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1.5rem', marginBottom: '2rem', scrollbarWidth: 'none' }}>
        {categories.map(cat => (
          <button 
            key={cat.id}
            onClick={() => setActiveCategory(activeCategory === cat.id ? '' : cat.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.6rem 1.2rem 0.6rem 0.6rem',
              borderRadius: '30px',
              border: '1px solid rgba(255,255,255,0.9)',
              background: activeCategory === cat.id ? 'linear-gradient(135deg, var(--primary) 0%, #ff6b81 100%)' : 'rgba(255, 255, 255, 0.85)',
              color: activeCategory === cat.id ? 'white' : 'var(--text-main)',
              fontWeight: '700',
              fontSize: '1.05rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: activeCategory === cat.id ? '0 8px 25px rgba(255, 71, 87, 0.4)' : '0 4px 15px rgba(31, 38, 135, 0.05)',
              transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
              transform: 'translateY(0)',
              backdropFilter: 'blur(8px)',
            }}
            onMouseOver={(e) => {
               if (activeCategory !== cat.id) {
                 e.currentTarget.style.transform = 'translateY(-4px)';
                 e.currentTarget.style.boxShadow = '0 10px 25px rgba(31, 38, 135, 0.08)';
               }
            }}
            onMouseOut={(e) => {
               if (activeCategory !== cat.id) {
                 e.currentTarget.style.transform = 'translateY(0)';
                 e.currentTarget.style.boxShadow = '0 4px 15px rgba(31, 38, 135, 0.05)';
               }
            }}
          >
            <div style={{
              background: activeCategory === cat.id ? 'rgba(255,255,255,0.2)' : 'white',
              width: '36px', height: '36px',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem',
              boxShadow: activeCategory === cat.id ? 'none' : '0 2px 8px rgba(0,0,0,0.06)'
            }}>
              {cat.icon}
            </div>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Shops Header */}
      <h3 style={{ 
        marginBottom: '1.5rem', 
        fontSize: '1.5rem', 
        fontWeight: '800', 
        color: 'var(--text-main)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem'
      }}>
        <span style={{ fontSize: '1.6rem' }}>🏪</span> Popular Shops
      </h3>

      {filteredShops.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-light)' }}>
          <p>No shops found matching your criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '2rem' }}>
          {filteredShops.map((shop) => (
            <Link to={`/shop/${shop.id}`} key={shop.id} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="shop-list-card" style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(16px)',
                borderRadius: '24px',
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(31, 38, 135, 0.05)',
                border: '1px solid rgba(255, 255, 255, 1)',
                transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                transform: 'translateY(0) scale(1)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 15px 40px rgba(255, 71, 87, 0.15)';
                const img = e.currentTarget.querySelector('img');
                if (img) img.style.transform = 'scale(1.08)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(31, 38, 135, 0.05)';
                const img = e.currentTarget.querySelector('img');
                if (img) img.style.transform = 'scale(1)';
              }}
              >
                <div style={{ position: 'relative', height: '220px', width: '100%', backgroundColor: '#f8f9fa', overflow: 'hidden' }}>
                  <img 
                    src={shop.image} 
                    alt={shop.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.6s cubic-bezier(0.25, 0.8, 0.25, 1)' }} 
                    onError={(e) => {
                      e.target.onerror = null; 
                      e.target.src = 'https://placehold.co/600x400/eee/999?text=' + encodeURIComponent(shop.name);
                    }}
                  />
                  <div style={{ 
                    position: 'absolute', 
                    top: '15px', 
                    right: '15px', 
                    background: 'rgba(255,255,255,0.9)', 
                    backdropFilter: 'blur(8px)',
                    padding: '0.4rem 0.8rem', 
                    borderRadius: '20px',
                    fontWeight: '800',
                    fontSize: '0.9rem',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    color: 'var(--text-main)'
                  }}>
                    <span style={{ color: '#FFC312', fontSize: '1.2rem', lineHeight: 1 }}>★</span> 
                    <span>{shop.rating}</span>
                  </div>
                  {!shop.isOpen && (
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      background: 'rgba(255,255,255,0.75)',
                      backdropFilter: 'blur(4px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <div style={{
                        background: '#ff4757',
                        color: 'white',
                        padding: '0.8rem 2rem',
                        borderRadius: '30px',
                        fontWeight: '900',
                        fontSize: '1.2rem',
                        letterSpacing: '1px',
                        boxShadow: '0 4px 15px rgba(255, 71, 87, 0.4)',
                        transform: 'rotate(-5deg)'
                      }}>
                        CLOSED
                      </div>
                    </div>
                  )}
                </div>
                
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.4rem', margin: 0, fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.3px' }}>{shop.name}</h2>
                    <span style={{ 
                      background: 'var(--bg-color)', 
                      padding: '0.3rem 0.8rem', 
                      borderRadius: '15px',
                      color: 'var(--text-main)', 
                      fontWeight: '700', 
                      fontSize: '0.85rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.3rem' 
                    }}>
                      <span style={{ fontSize: '1.1rem' }}>⏱</span> {shop.time}
                    </span>
                  </div>
                  <div style={{ color: 'var(--text-light)', fontSize: '1rem', fontWeight: '500' }}>
                    {shop.description} <span style={{ margin: '0 0.5rem', color: '#ccc' }}>•</span> {shop.costForTwo}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Shops;
