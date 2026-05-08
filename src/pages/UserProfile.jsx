import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { LogOut, User, Clock } from 'lucide-react';
import './pages.css';
import './profile.css';

const UserProfile = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    const savedSession = localStorage.getItem('sgu_user');
    if (savedSession) {
      setUserData(JSON.parse(savedSession));
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('sgu_token');
    localStorage.removeItem('sgu_user');
    localStorage.removeItem('sgu_cart'); // Clear cart on logout for security
    navigate('/login', { replace: true });
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
            <h2 style={{ textTransform: 'capitalize' }}>{userData?.name || 'SGU User'}</h2>
            <p className="text-muted">{userData?.id || '+91 -'}</p>
          </div>
        </GlassCard>

        {/* Order History */}
        <div className="history-section animate-stagger-item stagger-delay-3">
          <h3 className="section-title text-muted">Recent Orders</h3>
          
          <GlassCard className="history-card" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <Clock size={32} style={{ color: 'var(--text-muted)', marginBottom: '8px', opacity: 0.4 }} />
            <p style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.9rem' }}>No orders yet</p>
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
