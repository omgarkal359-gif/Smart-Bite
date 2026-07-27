import React, { useState } from 'react';
import FoodCard from '../components/FoodCard';

export const dummyFoodData = [
  {
    id: 'f1',
    name: 'Classic Cheeseburger',
    description: 'Juicy beef patty with melted cheese, lettuce, and our special sauce.',
    price: 8.99,
    category: 'Meals',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&q=80',
  },
  {
    id: 'f2',
    name: 'Margherita Pizza',
    description: 'Fresh mozzarella, tomato sauce, and basil on a crispy thin crust.',
    price: 12.50,
    category: 'Meals',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=500&q=80',
  },
  {
    id: 'f3',
    name: 'Caesar Salad',
    description: 'Crisp romaine lettuce, parmesan cheese, croutons, and Caesar dressing.',
    price: 7.50,
    category: 'Snacks',
    image: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=500&q=80',
  },
  {
    id: 'f4',
    name: 'Spicy Chicken Wings',
    description: 'Crispy fried wings tossed in our signature hot sauce.',
    price: 9.99,
    category: 'Snacks',
    image: 'https://images.unsplash.com/photo-1524114664604-cd8133cd67ad?w=500&q=80',
  },
  {
    id: 'f5',
    name: 'Iced Caramel Macchiato',
    description: 'Refreshing espresso mixed with milk and caramel syrup over ice.',
    price: 4.50,
    category: 'Drinks',
    image: 'https://images.unsplash.com/photo-1485808191679-5f86510681a2?w=500&q=80',
  },
  {
    id: 'f6',
    name: 'Mango Smoothie',
    description: 'Sweet and creamy smoothie made with fresh tropical mangoes.',
    price: 5.50,
    category: 'Drinks',
    image: 'https://images.unsplash.com/photo-1525804018705-0e31e50fba20?w=500&q=80',
  }
];

const categories = ['All', 'Meals', 'Snacks', 'Drinks'];

const Home = () => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredData = dummyFoodData.filter(item => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="page-container">
      {/* Hero Section */}
      <div className="hero-section">
        <h1 className="hero-title">Delicious food, <br/><span className="text-primary">delivered to you</span></h1>
        <p className="hero-subtitle">Discover the best food and drinks in your area.</p>
        
        <div className="search-bar-container">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search for food, drinks, etc..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Categories */}
      <div className="categories-container">
        {categories.map(cat => (
          <button 
            key={cat}
            className={`category-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            <span className="cat-icon">{cat === 'All' ? '🍽️' : cat === 'Meals' ? '🍔' : cat === 'Snacks' ? '🍟' : '🥤'}</span> 
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Grid */}
      <h2 className="section-title" style={{ marginTop: '2rem', marginBottom: '1.5rem', fontSize: '1.8rem' }}>
        {activeCategory} Menu
      </h2>
      
      {filteredData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-light)', background: 'var(--card-bg)', borderRadius: 'var(--border-radius)', backdropFilter: 'blur(10px)' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>No items found 😔</h3>
          <p>Try adjusting your search or category filter.</p>
        </div>
      ) : (
        <div className="food-grid">
          {filteredData.map((item) => (
            <FoodCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
