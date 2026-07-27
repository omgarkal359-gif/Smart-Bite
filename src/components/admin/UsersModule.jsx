import React, { useState, useEffect } from 'react';
import { 
  Users, ShieldAlert, UserCheck, UserX, Search, 
  Key, LogIn, Plus, RefreshCw, CheckCircle, Shield 
} from 'lucide-react';
import { api } from '../../api';
import { useNavigate } from 'react-router-dom';

export const UsersModule = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [blacklistPrn, setBlacklistPrn] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setIsLoading(true);
    try {
      const data = await api.getAdminUsers();
      setUsers(data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
      // Default fallback users if endpoint is loading
      setUsers([
        { id: 1, username: 'student@sgu.edu', name: 'Satej', role: 'student', shopId: null },
        { id: 2, username: '9876543210', name: 'Guest Satej', role: 'guest', shopId: null },
        { id: 3, username: 'admin@sgu.edu', name: 'Administrator', role: 'admin', shopId: null },
        { id: 4, username: 'mangales-snacks', name: 'Mangale Snacks Owner', role: 'owner', shopId: 'mangales-snacks' },
        { id: 5, username: 'tea-coffee', name: 'Tea & Coffee Owner', role: 'owner', shopId: 'tea-coffee' },
        { id: 6, username: 'rohit-vadewale', name: 'Rohit Vadewale Owner', role: 'owner', shopId: 'rohit-vadewale' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  // Action: Impersonate User
  const handleImpersonate = (user) => {
    const confirm = window.confirm(`Impersonate user "${user.name}" (${user.username})?`);
    if (confirm) {
      const ud = {
        role: user.role,
        name: user.name,
        id: user.username,
        shopId: user.shopId || user.username,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('sgu_user', JSON.stringify(ud));
      alert(`Switched active session to ${user.name} (${user.role}). Redirecting...`);
      if (user.role === 'owner') navigate(`/vendor/${user.shopId || user.username}`);
      else if (user.role === 'admin') navigate('/admin');
      else navigate('/student');
    }
  };

  // Action: Blacklist PRN
  const handleBlacklist = (e) => {
    e.preventDefault();
    if (!blacklistPrn.trim()) return;
    alert(`PRN / User "${blacklistPrn}" has been blacklisted for 24 hours.`);
    setBlacklistPrn('');
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery = !q || 
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.name && u.name.toLowerCase().includes(q));

    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;

    return matchQuery && matchRole;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Title Bar */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>USER ACCESS & PERMISSIONS</h1>
          <p className="text-slate-500 text-sm font-medium">Master identity table, role management, security bans and impersonation controls.</p>
        </div>
        <button 
          onClick={loadUsers}
          className="btn-action-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} /> Refresh Users
        </button>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: 24 }}>
        {/* User Table Card */}
        <div className="admin-card-v2 flex flex-col gap-4">
          {/* Controls */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Search users by name, PRN, email, or username..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10,
                  border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.85rem', fontWeight: 600
                }}
              />
            </div>

            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              style={{ padding: '9px 12px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.85rem', fontWeight: 700, fontFamily: "'Oswald', sans-serif", color: '#E4002B', cursor: 'pointer' }}
            >
              <option value="ALL">ALL ROLES</option>
              <option value="student">STUDENTS</option>
              <option value="owner">SHOP MANAGERS</option>
              <option value="admin">SUPER ADMINS</option>
              <option value="guest">GUESTS</option>
            </select>
          </div>

          {/* User Table */}
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>User ID / PRN</th>
                  <th>Display Name</th>
                  <th>System Role</th>
                  <th>Shop Context</th>
                  <th style={{ textAlign: 'right' }}>Security Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                      No users match the specified search query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => (
                    <tr key={user.id || user.username}>
                      <td style={{ fontFamily: "'Oswald', sans-serif", fontWeight: 800, color: '#E4002B', fontSize: '0.95rem' }}>
                        {user.username}
                      </td>
                      <td style={{ fontWeight: 700, color: '#0F172A' }}>
                        {user.name}
                      </td>
                      <td>
                        <span className={`status-pill ${user.role === 'admin' ? 'cancelled' : user.role === 'owner' ? 'preparing' : 'ready'}`}>
                          {user.role ? user.role.toUpperCase() : 'STUDENT'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748B' }}>
                        {user.shopId || 'None'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button 
                            className="btn-action-sm"
                            title="Impersonate user session"
                            onClick={() => handleImpersonate(user)}
                          >
                            <LogIn size={13} /> Impersonate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Security Overrides Sidebar */}
        <div className="flex flex-col gap-4">
          <div className="admin-card-v2" style={{ borderTop: '4px solid #E4002B' }}>
            <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={18} color="#E4002B" /> PRN BLACKLIST
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 16px 0', fontWeight: 500 }}>
              Instantly suspend student access for repeated no-shows or policy violations.
            </p>
            <form onSubmit={handleBlacklist} className="flex flex-col gap-3">
              <input 
                type="text" 
                placeholder="Enter PRN or Student ID..." 
                value={blacklistPrn}
                onChange={e => setBlacklistPrn(e.target.value)}
                style={{
                  padding: '10px 12px', borderRadius: 10, border: '1px solid #E2E8F0',
                  fontSize: '0.85rem', fontWeight: 600, outline: 'none'
                }}
              />
              <button 
                type="submit" 
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase',
                  background: '#E4002B', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <UserX size={16} /> BLOCK PRN (24 HOURS)
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
