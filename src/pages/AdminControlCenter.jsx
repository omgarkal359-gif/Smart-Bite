import React, { useState } from 'react';
import { GlassCard } from '../components/ui/GlassCard';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Trash2, Ban, TrendingUp, BarChart3, Clock, AlertTriangle, LogOut } from 'lucide-react';
import './pages.css';
import './admin.css';

const AdminControlCenter = () => {
  const navigate = useNavigate();
  const [blacklistPrn, setBlacklistPrn] = useState('');

  const handleGlobalWipe = () => {
    const confirm = window.confirm("CRITICAL WARNING: This will flush all active queues globally. Continue?");
    if (confirm) {
      alert("System queues flushed successfully.");
    }
  };

  const handleBlacklist = (e) => {
    e.preventDefault();
    if (blacklistPrn) {
      alert(`PRN ${blacklistPrn} has been blacklisted for 24 hours.`);
      setBlacklistPrn('');
    }
  };

  return (
    <div className="admin-container container">
      <header className="glass-header admin-header">
        <div className="admin-header-left">
          <div className="shield-icon">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="heading-2">God Mode (Super Admin)</h1>
            <p className="text-muted" style={{ fontSize: '0.875rem' }}>System Control Center</p>
          </div>
        </div>
        <button className="btn-icon" onClick={() => navigate('/login')}>
          <LogOut size={20} />
        </button>
      </header>

      <div className="admin-grid">
        {/* Analytics Section */}
        <div className="admin-col">
          <h2 className="section-title"><BarChart3 size={20} /> Analytics Overview</h2>
          
          <GlassCard className="admin-card mb-4 animate-stagger-item stagger-delay-1">
            <h3>Daily Sales</h3>
            <div className="sales-stats">
              <div className="stat-box digital">
                <span className="label">Digital</span>
                <span className="value">₹45,200</span>
              </div>
              <div className="stat-box cash">
                <span className="label">Cash</span>
                <span className="value">₹12,800</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="admin-card mb-4 animate-stagger-item stagger-delay-2">
            <h3>Peak Hour Activity</h3>
            <div className="heatmap-mock">
              {/* Mock Heatmap Bars */}
              {[20, 40, 60, 100, 80, 50, 30].map((val, i) => (
                <div key={i} className="heat-bar-wrapper">
                  <div className="heat-bar" style={{ height: `${val}%`, backgroundColor: val > 70 ? 'var(--error-red)' : 'var(--primary-navy)' }} />
                  <span className="heat-label">{10 + i}AM</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        {/* System Health Section */}
        <div className="admin-col">
          <h2 className="section-title"><Clock size={20} /> System Health</h2>
          
          <GlassCard className="admin-card mb-4 animate-stagger-item stagger-delay-3">
            <h3>Shop Downtime Logs</h3>
            <ul className="downtime-list">
              <li>
                <span className="shop-name">Spicy Wok</span>
                <span className="downtime text-error">Offline (20m)</span>
              </li>
              <li>
                <span className="shop-name">Taco Fiesta</span>
                <span className="downtime text-error">Offline (1h 5m)</span>
              </li>
              <li>
                <span className="shop-name">Cafe Mocha</span>
                <span className="downtime text-success">Recovered</span>
              </li>
            </ul>
          </GlassCard>
        </div>

        {/* Overrides Section */}
        <div className="admin-col">
          <h2 className="section-title text-error"><AlertTriangle size={20} /> Global Overrides</h2>
          
          <GlassCard className="admin-card danger-card mb-4 animate-stagger-item stagger-delay-4">
            <h3>PRN Blacklist</h3>
            <p className="text-muted mb-4" style={{ fontSize: '0.875rem' }}>Block students for no-shows.</p>
            <form onSubmit={handleBlacklist} className="blacklist-form">
              <Input 
                placeholder="Enter PRN..." 
                value={blacklistPrn}
                onChange={(e) => setBlacklistPrn(e.target.value)}
                className="mb-0"
              />
              <Button type="submit" variant="secondary" className="btn-block mt-2">
                <Ban size={16} /> Block User
              </Button>
            </form>
          </GlassCard>

          <GlassCard className="admin-card danger-card animate-stagger-item stagger-delay-5">
            <h3>Emergency Flush</h3>
            <p className="text-muted mb-4" style={{ fontSize: '0.875rem' }}>Wipe all active queues across all shops. Use only during severe tech failures.</p>
            <Button className="btn-flush" onClick={handleGlobalWipe}>
              <Trash2 size={16} /> GLOBAL QUEUE WIPE
            </Button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default AdminControlCenter;
