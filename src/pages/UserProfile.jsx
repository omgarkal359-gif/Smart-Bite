import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { LogOut, User, Moon, Sun, Settings, Clock, ChevronRight } from 'lucide-react';
import './pages.css';
import './profile.css';

const UserProfile = () => {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // In a real app, this would be set in a Context or directly on the document root
    document.querySelector('.mobile-layout').setAttribute('data-theme', !isDarkMode ? 'dark' : 'light');
  };

  const handleLogout = () => {
    localStorage.removeItem('sgu_token');
    navigate('/login');
  };

  return (
    <div className="profile-container page-transition">
      <header className="glass-header menu-header">
        <h1 className="heading-2">Profile</h1>
      </header>

      <main className="profile-main">
        {/* User Info Card */}
        <GlassCard className="profile-card user-info animate-stagger-item stagger-delay-1">
          <div className="avatar-placeholder">
            <User size={40} />
          </div>
          <div className="user-details">
            <h2>Omkar Garg</h2>
            <p className="text-muted">PRN: 21010101</p>
            <p className="text-muted">+91 9876543210</p>
          </div>
        </GlassCard>

        {/* Settings Toggle */}
        <div className="settings-section animate-stagger-item stagger-delay-2">
          <h3 className="section-title text-muted">Preferences</h3>
          <GlassCard className="settings-card tap-effect transition-smooth" onClick={toggleTheme}>
            <div className="settings-item-left">
              {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
              <span>{isDarkMode ? 'Dark Mode' : 'Light Mode'}</span>
            </div>
            <div className={`toggle-switch ${isDarkMode ? 'active' : ''}`} />
          </GlassCard>
        </div>

        {/* Order History */}
        <div className="history-section animate-stagger-item stagger-delay-3">
          <h3 className="section-title text-muted">Recent Orders</h3>
          
          <GlassCard className="history-card tap-effect transition-smooth">
            <div className="history-header">
              <span className="order-id">SGU-24-001</span>
              <span className="order-date">Today, 10:45 AM</span>
            </div>
            <div className="history-body-v20">
              <div className="history-thumb">🍕</div>
              <div className="history-details">
                <p>Pizza Paradise</p>
                <span className="price">₹150</span>
              </div>
              <span className="status-badge success">Delivered</span>
            </div>
          </GlassCard>

          <GlassCard className="history-card tap-effect transition-smooth">
            <div className="history-header">
              <span className="order-id">SGU-24-000</span>
              <span className="order-date">Yesterday, 1:20 PM</span>
            </div>
            <div className="history-body-v20">
              <div className="history-thumb">🍔</div>
              <div className="history-details">
                <p>Burger Joint</p>
                <span className="price">₹220</span>
              </div>
              <span className="status-badge success">Delivered</span>
            </div>
          </GlassCard>
        </div>

        <Button variant="secondary" className="btn-logout mt-4 tap-effect animate-stagger-item stagger-delay-4" onClick={handleLogout}>
          <LogOut size={18} /> Logout
        </Button>
      </main>
    </div>
  );
};

export default UserProfile;
