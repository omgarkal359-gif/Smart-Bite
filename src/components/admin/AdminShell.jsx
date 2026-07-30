import React, { useState, useEffect } from 'react';
import { 
  BarChart3, ShoppingBag, Users, Settings, ShieldAlert, 
  Menu, X, Search, LogOut, ChevronDown, Activity, 
  LayoutDashboard, Store, AlertTriangle, Radio
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import sguLogo from '../../assets/sgu-logo.jpg';
import { CmdKSearchModal } from './CmdKSearchModal';
import { supabase } from '../../supabaseClient';
import { clearStoredUser } from '../../utils/auth';
import './admin_dashboard.css';

export const AdminShell = ({ activeModule, setActiveModule, user, children }) => {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isCmdKOpen, setIsCmdKOpen] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState('ONLINE'); // ONLINE | RECONNECTING

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCmdKOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Monitor Supabase Realtime channel status for health indicator
  useEffect(() => {
    const channel = supabase.channel('admin-health-monitor')
      .on('system', { event: '*' }, () => {})
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('ONLINE');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('RECONNECTING');
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Close profile dropdown on outside click
  const profileMenuRef = React.useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearStoredUser();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, badge: null },
    { id: 'orders', label: 'Orders & Shops', icon: ShoppingBag, badge: 'LIVE' },
    { id: 'users', label: 'User Access', icon: Users, badge: null },
    { id: 'config', label: 'Platform Config', icon: Settings, badge: null },
    { id: 'logs', label: 'System Audit Logs', icon: ShieldAlert, badge: 'LOGS' },
  ];

  return (
    <div className="admin-layout-root">
      {/* Cmd+K Search Modal */}
      <CmdKSearchModal 
        isOpen={isCmdKOpen} 
        onClose={() => setIsCmdKOpen(false)} 
        onNavigateModule={(mod) => { setActiveModule(mod); setIsCmdKOpen(false); }} 
        onLogout={handleLogout}
      />

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 99 }}
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* Admin Sidebar */}
      <aside className={`admin-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <ShieldAlert size={22} />
            </div>
            <div className="sidebar-logo-text flex flex-col">
                <span style={{ fontSize: '1.1rem', fontWeight: 800, letterSpacing: '0.04em', display: 'block' }}>ADMIN DASHBOARD</span>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.1em', display: 'block' }}>SGU SMARTBITE ENTERPRISE</span>
              </div>
          </div>
          <button 
            onClick={() => {
              if (isMobileMenuOpen) {
                setIsMobileMenuOpen(false);
              } else {
                setIsSidebarCollapsed(!isSidebarCollapsed);
              }
            }}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', cursor: 'pointer', padding: 4 }}
          >
            {isMobileMenuOpen ? <X size={20} /> : (isSidebarCollapsed ? null : <Menu size={18} />)}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                className={`admin-nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveModule(item.id);
                  setIsMobileMenuOpen(false);
                }}
                title={item.label}
              >
                <div className="admin-nav-icon-wrapper"><Icon size={20} /></div>
                <span className="admin-nav-label">{item.label}</span>
                {item.badge && (
                  <span className="admin-nav-item-badge">{item.badge}</span>
                )}
              </button>
            );
          })}

          <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <button
              className="admin-nav-item admin-logout-nav-item"
              onClick={handleLogout}
              title="Sign Out"
            >
              <div className="admin-nav-icon-wrapper"><LogOut size={18} color="#FFFFFF" /></div>
              <span className="admin-nav-label" style={{ color: '#FFFFFF', fontWeight: 800 }}>Sign Out</span>
            </button>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer" style={{ padding: '14px', borderTop: '1px solid rgba(255,255,255,0.12)', margin: '0 12px 12px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: 14 }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>System Engine</div>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Radio size={12} color="#86EFAC" /> Supabase Realtime Active
            </div>
          </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-main-container">
        {/* Top Header Bar */}
        <header className="admin-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button 
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{ background: 'none', border: 'none', color: '#0F172A', cursor: 'pointer' }}
            >
              <Menu size={24} />
            </button>

            {/* Cmd+K Search Trigger */}
            <button className="cmdk-trigger-btn" onClick={() => setIsCmdKOpen(true)}>
              <Search size={16} />
              <span>Search orders, shops, users...</span>
              <span className="cmdk-kbd">⌘K</span>
            </button>
          </div>

          <div className="topbar-right">
            {/* Realtime Health Badge */}
            <div className="health-badge">
              <span className="health-dot" />
              <span>{realtimeStatus === 'ONLINE' ? 'SUPABASE REALTIME ACTIVE' : 'RECONNECTING'}</span>
            </div>

            {/* Admin Profile Dropdown */}
            <div ref={profileMenuRef} style={{ position: 'relative' }}>
              <div 
                className="admin-profile-pill"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              >
                <div className="admin-avatar">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>
                    {user?.name || 'Administrator'}
                  </span>
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#FF3B5C', textTransform: 'uppercase', fontFamily: "'Oswald', sans-serif" }}>
                    SUPER ADMIN
                  </span>
                </div>
                <ChevronDown size={14} color="#64748B" />
              </div>

              {isProfileMenuOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: '120%', width: 220,
                  background: '#FFFFFF', borderRadius: 16, border: '1px solid #E2E8F0',
                  boxShadow: '0 15px 30px rgba(0,0,0,0.12)', padding: 8, zIndex: 100
                }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9', marginBottom: 4 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0F172A' }}>{user?.name || 'Administrator'}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{user?.username || 'admin@sgu.edu'}</div>
                  </div>
                  <button 
                    onClick={() => { setIsProfileMenuOpen(false); setActiveModule('config'); }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'none', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}
                  >
                    <Settings size={16} /> Admin Settings
                  </button>

                </div>
              )}
            </div>

            {/* Direct Topbar Logout Button */}
            <button 
              className="admin-topbar-logout-btn"
              onClick={handleLogout}
              title="Sign Out of Admin Dashboard"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* Dynamic Module Content */}
        <main className="admin-content-frame">
          {children}
        </main>
      </div>
    </div>
  );
};
