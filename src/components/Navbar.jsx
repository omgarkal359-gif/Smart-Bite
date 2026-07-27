import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const Navbar = () => {
  const { currentUser, logout } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Local state for search bar in navbar
  const searchParams = new URLSearchParams(location.search);
  const initialSearch = searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  // Hide the global Navbar on the Admin Dashboard so it can use a fullscreen layout
  if (location.pathname === '/admin') {
    return null;
  }

  const handleLogout = async () => {
    try {
      await logout();
      setIsMenuOpen(false);
      navigate('/auth');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (location.pathname !== '/shops' && location.pathname !== '/') {
      navigate(`/shops?q=${searchQuery}`);
    } else {
      navigate(`${location.pathname}?q=${searchQuery}`, { replace: true });
    }
  };

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <nav className="navbar" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '2rem' }}>
      <Link to="/shops" className="navbar-brand">
        <div className="logo-icon" style={{ filter: 'drop-shadow(0px 8px 16px rgba(255, 71, 87, 0.35))', display: 'flex', marginRight: '0.2rem' }}>
          <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="42" height="42" rx="14" fill="url(#grad_logo)"/>
            {/* Top Bun */}
            <path d="M13 22.5C13 18.0817 16.5817 14.5 21 14.5C25.4183 14.5 29 18.0817 29 22.5H13Z" fill="#F3B168"/>
            {/* Lettuce */}
            <path d="M12 23.5C12 23.5 14 22.5 16 23.5C18 24.5 20 22.5 22 23.5C24 24.5 26 22.5 28 23.5C30 24.5 30 23.5 30 23.5" stroke="#2ED573" strokeWidth="2.5" strokeLinecap="round"/>
            {/* Cheese */}
            <path d="M13 25L16 27L19 25L22 27L25 25L29 25" stroke="#FFA502" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            {/* Patty */}
            <rect x="12" y="25" width="18" height="3" rx="1.5" fill="#574B40"/>
            {/* Bottom Bun */}
            <path d="M14 28.5C14 30.9853 17.134 31.5 21 31.5C24.866 31.5 28 30.9853 28 28.5H14Z" fill="#F3B168"/>
            {/* Seeds */}
            <circle cx="17" cy="18" r="1" fill="#FFF2E1"/>
            <circle cx="21" cy="17" r="1" fill="#FFF2E1"/>
            <circle cx="25" cy="18" r="1" fill="#FFF2E1"/>
            <defs>
              <linearGradient id="grad_logo" x1="0" y1="0" x2="42" y2="42" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ff4757"/>
                <stop offset="1" stopColor="#ff6b81"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="logo-text desktop-only" style={{ fontSize: '1.7rem', fontWeight: '900', letterSpacing: '-0.5px' }}>
          <span style={{ color: '#2f3542' }}>Foodie</span>
          <span style={{ color: '#ff4757' }}>Express</span>
        </span>
      </Link>
      
      <form onSubmit={handleSearchSubmit} className="nav-search-container">
        <span className="search-icon">🔍</span>
        <input 
          type="text" 
          className="nav-search-input" 
          placeholder="Search food or shop"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </form>

      <div className="nav-actions">
        <Link to="/cart" className="nav-cart-btn">
          🛒 <span className="desktop-only" style={{marginLeft: '0.5rem'}}>Cart</span>
          {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
        </Link>
        
        <button className="hamburger-btn" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      <div className={`navbar-links ${isMenuOpen ? 'open' : ''}`}>
        <Link to="/shops" onClick={() => setIsMenuOpen(false)}>Shops</Link>
        {currentUser && (
          <>
            <Link to="/orders" onClick={() => setIsMenuOpen(false)}>My Orders</Link>
            <Link to="/admin" onClick={() => setIsMenuOpen(false)}>Admin</Link>
          </>
        )}
        {currentUser ? (
          <div className="user-menu" style={{marginTop: 'auto'}}>
            <span className="user-email">{currentUser.email}</span>
            <button onClick={handleLogout} className="btn btn-outline" style={{width: '100%'}}>Logout</button>
          </div>
        ) : (
          <Link to="/auth" className="btn btn-primary" onClick={() => setIsMenuOpen(false)} style={{marginTop: 'auto', textAlign: 'center'}}>
            Login
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
