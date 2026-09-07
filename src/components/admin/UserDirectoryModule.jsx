import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Filter, RefreshCw, ShieldAlert, UserCheck, UserX, KeyRound, Mail, Eye, Plus, Shield
} from 'lucide-react';
import { adminApi } from '../../utils/adminApi';
import { addAuditLog } from '../../utils/logger';
import { SHOPS } from '../../data/foodCourtDB';
import { useCart } from '../../context/CartContext';

export const UserDirectoryModule = () => {
  const { showToast } = useCart();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  
  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [roleEditUser, setRoleEditUser] = useState(null);

  // New User Form State
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'student',
    shopId: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Role Edit Form State
  const [editRoleData, setEditRoleData] = useState({
    role: 'student',
    shopId: ''
  });

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setIsLoading(true);
    try {
      const res = await adminApi.getUsers().catch(() => ({ success: true, users: [] }));
      const dbUsers = res.users || [];
      const seedUsers = [
        { id: 'usr-1', username: 'omgarkal359@gmail.com', name: 'Om Garkal', role: 'admin', shopId: null, status: 'ACTIVE' },
        { id: 'usr-1b', username: 'omgarkal357@gmail.com', name: 'Om Garkal Admin', role: 'admin', shopId: null, status: 'ACTIVE' },
        { id: 'usr-2', username: 'rohit-vadewale', name: 'Rohit Vadewale Owner', role: 'owner', shopId: 'rohit-vadewale', status: 'ACTIVE' },
        { id: 'usr-3', username: '252921004@sguk.ac.in', name: 'Aditya Sharma', role: 'student', shopId: null, status: 'ACTIVE' },
        { id: 'usr-4', username: '252921012@sguk.ac.in', name: 'Sneha Patil', role: 'student', shopId: null, status: 'ACTIVE' },
        { id: 'usr-5', username: 'mangales-snacks', name: 'Mangale Snacks Owner', role: 'owner', shopId: 'mangales-snacks', status: 'ACTIVE' }
      ];

      // Merge with custom added/updated users in localStorage
      let localDirectory = [];
      try {
        localDirectory = JSON.parse(localStorage.getItem('sgu_user_directory') || '[]');
      } catch (e) {}

      const userMap = new Map();
      seedUsers.forEach(u => userMap.set(u.id, u));
      dbUsers.forEach(u => userMap.set(u.id || u.username, { ...userMap.get(u.id || u.username), ...u }));
      localDirectory.forEach(u => userMap.set(u.id || u.username, { ...userMap.get(u.id || u.username), ...u }));

      setUsers(Array.from(userMap.values()));
    } catch (err) {
      console.error('Failed to load user directory:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!formData.email || !formData.email.includes('@')) {
      alert('Please enter a valid email address.');
      return;
    }

    const email = formData.email.trim().toLowerCase();
    const existing = users.find(u => (u.username && u.username.toLowerCase() === email) || (u.email && u.email.toLowerCase() === email));
    if (existing) {
      alert(`User with email '${email}' is already registered! You can change or promote their role directly in the table.`);
      return;
    }

    setIsSubmitting(true);
    const userId = `usr-${Date.now()}`;
    const newUser = {
      id: userId,
      username: email,
      email: email,
      name: formData.name.trim() || email.split('@')[0],
      role: formData.role,
      shopId: formData.role === 'owner' ? (formData.shopId || 'rohit-vadewale') : null,
      status: 'ACTIVE'
    };

    // Optimistic Update
    setUsers(prev => [newUser, ...prev]);

    // Save to LocalStorage
    try {
      const stored = JSON.parse(localStorage.getItem('sgu_user_directory') || '[]');
      stored.unshift(newUser);
      localStorage.setItem('sgu_user_directory', JSON.stringify(stored));
    } catch (e) {}

    try {
      await adminApi.createUser(newUser).catch(() => {});
      addAuditLog({
        level: 'SECURITY',
        category: 'Auth',
        message: `New user '${newUser.username}' (${newUser.role.toUpperCase()}) provisioned by Admin`
      });
      setShowAddModal(false);
      setFormData({ email: '', name: '', role: 'student', shopId: '' });
    } catch (err) {
      setShowAddModal(false);
      setFormData({ email: '', name: '', role: 'student', shopId: '' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateUserRole(targetUser, newRole, targetShopId) {
    const userId = targetUser.id || targetUser.username;
    if (targetUser.role === newRole && (targetShopId === undefined || targetShopId === targetUser.shopId)) {
      return;
    }

    const roleLabels = { admin: 'SUPER ADMIN', owner: 'VENDOR OWNER', student: 'STUDENT' };
    const oldRoleLabel = roleLabels[targetUser.role] || targetUser.role?.toUpperCase() || 'STUDENT';
    const newRoleLabel = roleLabels[newRole] || newRole?.toUpperCase() || 'STUDENT';

    const effectiveShopId = newRole === 'owner' ? (targetShopId || targetUser.shopId || 'rohit-vadewale') : null;

    // Optimistic Update
    setUsers(prev => prev.map(u => (u.id === userId || u.username === userId) ? { ...u, role: newRole, shopId: effectiveShopId } : u));

    // Save to LocalStorage
    try {
      const stored = JSON.parse(localStorage.getItem('sgu_user_directory') || '[]');
      const updatedUser = { ...targetUser, role: newRole, shopId: effectiveShopId };
      const idx = stored.findIndex(u => u.id === userId || u.username === userId);
      if (idx >= 0) stored[idx] = updatedUser;
      else stored.push(updatedUser);
      localStorage.setItem('sgu_user_directory', JSON.stringify(stored));
    } catch (e) {}

    try {
      await adminApi.updateUserRole(userId, newRole, effectiveShopId).catch(() => {});
      addAuditLog({
        level: 'SECURITY',
        category: 'RBAC',
        message: `Role for '${targetUser.username || targetUser.name}' updated from ${oldRoleLabel} to ${newRoleLabel}`
      });
    } catch (err) {
      console.warn('API role update notice:', err.message);
    }

    if (roleEditUser) {
      setRoleEditUser(null);
    }
  }

  async function handleToggleUserStatus(userId, currentStatus) {
    const nextStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';

    // Optimistic Update
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: nextStatus } : u));

    try {
      await adminApi.updateUserStatus(userId, nextStatus);
      addAuditLog({
        level: 'SECURITY',
        category: 'Auth',
        message: `User account '${userId}' status set to ${nextStatus} by Super Admin`
      });
    } catch (err) {
      alert('Failed to update user status: ' + err.message);
      loadUsers();
    }
  }

  async function handleResetSession(userId, username) {
    const confirm = window.confirm(`Reset active authentication tokens and sessions for user ${username}?`);
    if (!confirm) return;

    try {
      await adminApi.resetUserSession(userId);
      addAuditLog({
        level: 'SECURITY',
        category: 'Auth',
        message: `Authentication session reset for user '${username}'`
      });
      alert(`Authentication sessions for ${username} have been reset successfully.`);
    } catch (err) {
      alert('Session reset failed: ' + err.message);
    }
  }

  const openEditRoleModal = (user) => {
    setRoleEditUser(user);
    setEditRoleData({
      role: user.role || 'student',
      shopId: user.shopId || 'rohit-vadewale'
    });
  };

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery = !q || (u.name && u.name.toLowerCase().includes(q)) || (u.username && u.username.toLowerCase().includes(q));
    const matchRole = selectedRole === 'ALL' || u.role === selectedRole;
    return matchQuery && matchRole;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>ENTERPRISE USER DIRECTORY</h1>
          <p className="text-slate-500 text-sm font-medium">Server-side user accounts, role assignments, account suspension, and session reset controls.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn-action-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FF3B5C', color: 'white', borderColor: '#FF3B5C', fontWeight: 800 }}
          >
            <Plus size={16} /> Provision New User
          </button>
          <button 
            onClick={loadUsers}
            className="btn-action-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} /> Refresh Directory
          </button>
        </div>
      </div>

      {/* Filter Deck */}
      <div className="admin-card-v2 flex flex-col gap-4">
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 280, maxWidth: 400 }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search by name, email, or roll number..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10,
                border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.85rem', fontWeight: 600
              }}
            />
          </div>

          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            style={{ padding: '9px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: '0.85rem', fontWeight: 700, fontFamily: "'Oswald', sans-serif", color: '#FF3B5C' }}
          >
            <option value="ALL">ALL ROLES</option>
            <option value="admin">SUPER ADMIN</option>
            <option value="owner">VENDOR OWNER</option>
            <option value="student">STUDENT</option>
          </select>
        </div>

        {/* Users Master Table */}
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User Account</th>
                <th>Role / Promotion</th>
                <th>Assigned Stall</th>
                <th>Account Status</th>
                <th style={{ textAlign: 'right' }}>Admin Overrides</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                    No users matching search filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => {
                  const isSuspended = user.status === 'SUSPENDED';
                  const currentRole = user.role || 'student';

                  return (
                    <tr key={user.id || user.username}>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{user.name || 'User'}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{user.username}</div>
                      </td>
                      <td>
                        {/* Inline Role Selector / Promoter */}
                        <select
                          value={currentRole}
                          onChange={(e) => handleUpdateUserRole(user, e.target.value, user.shopId)}
                          style={{
                            padding: '4px 10px', borderRadius: 8, border: '1px solid #CBD5E1',
                            fontSize: '0.75rem', fontWeight: 800, fontFamily: "'Oswald', sans-serif",
                            cursor: 'pointer', outline: 'none',
                            background: currentRole === 'admin' ? '#FFE4E6' : currentRole === 'owner' ? '#FEF3C7' : '#F1F5F9',
                            color: currentRole === 'admin' ? '#E11D48' : currentRole === 'owner' ? '#D97706' : '#475569',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <option value="student">🎓 STUDENT</option>
                          <option value="owner">🏪 VENDOR OWNER</option>
                          <option value="admin">👑 SUPER ADMIN</option>
                        </select>
                      </td>
                      <td style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1A5276' }}>
                        {user.shopId || 'N/A (Campus General)'}
                      </td>
                      <td>
                        <span className={`status-pill ${isSuspended ? 'cancelled' : 'ready'}`}>
                          {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button 
                            title="Promote / Edit Role"
                            style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#2563EB', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
                            onClick={() => openEditRoleModal(user)}
                          >
                            <UserCheck size={15} />
                          </button>
                          <button 
                            title="Reset Auth Session"
                            style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #E2E8F0', background: '#FFFFFF', color: '#475569', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' }}
                            onClick={() => handleResetSession(user.id, user.username)}
                          >
                            <KeyRound size={15} />
                          </button>
                          <button 
                            title={isSuspended ? 'Reactivate User Account' : 'Suspend User Account'}
                            style={{ 
                              width: 34, height: 34, borderRadius: 10, 
                              border: isSuspended ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)', 
                              background: isSuspended ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                              color: isSuspended ? '#059669' : '#DC2626', 
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' 
                            }}
                            onClick={() => handleToggleUserStatus(user.id, user.status)}
                          >
                            {isSuspended ? <UserCheck size={15} /> : <UserX size={15} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision New User Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div className="admin-card-v2" style={{ maxWidth: 480, width: '100%', padding: 28, background: '#FFFFFF', borderRadius: 20 }}>
            <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.4rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0' }}>
              PROVISION NEW ENTERPRISE USER
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 16px 0', fontWeight: 600 }}>
              Specify user email address, name, and assigned system role permissions.
            </p>

            <form onSubmit={handleCreateUser} className="flex flex-col gap-4">
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>EMAIL ADDRESS / USERNAME *</label>
                <input 
                  type="email" required placeholder="e.g. aditya.sharma@sguk.ac.in"
                  value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>FULL NAME</label>
                <input 
                  type="text" placeholder="e.g. Aditya Sharma"
                  value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600 }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>SYSTEM ROLE *</label>
                <select 
                  value={formData.role} 
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700, fontFamily: "'Oswald', sans-serif" }}
                >
                  <option value="student">🎓 STUDENT (CAMPUS USER)</option>
                  <option value="owner">🏪 VENDOR OWNER (STALL MANAGER)</option>
                  <option value="admin">👑 SUPER ADMIN (SYSTEM OVERSEER)</option>
                </select>
              </div>

              {formData.role === 'owner' && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>ASSIGNED STALL *</label>
                  <select 
                    value={formData.shopId} 
                    onChange={e => setFormData({ ...formData, shopId: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <option value="">Select Food Court Stall...</option>
                    {SHOPS.map(shop => (
                      <option key={shop.id} value={shop.id}>{shop.name} ({shop.id})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button 
                  type="button" onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" disabled={isSubmitting}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#FF3B5C', color: 'white', fontWeight: 800, fontFamily: "'Oswald', sans-serif", fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  {isSubmitting ? 'PROVISIONING...' : 'PROVISION USER'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Role / Promotion Modal */}
      {roleEditUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div className="admin-card-v2" style={{ maxWidth: 460, width: '100%', padding: 28, background: '#FFFFFF', borderRadius: 20 }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: '#E11D48' }}>
              <Shield size={20} />
              <h2 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                PROMOTE & CHANGE USER ROLE
              </h2>
            </div>
            <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '0 0 16px 0', fontWeight: 600 }}>
              Updating role permissions for <strong style={{ color: '#0F172A' }}>{roleEditUser.name}</strong> ({roleEditUser.username}).
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>TARGET ROLE *</label>
                <select 
                  value={editRoleData.role} 
                  onChange={e => setEditRoleData({ ...editRoleData, role: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 800, fontFamily: "'Oswald', sans-serif" }}
                >
                  <option value="student">🎓 STUDENT (Standard Ordering Access)</option>
                  <option value="owner">🏪 VENDOR OWNER (Stall Management Access)</option>
                  <option value="admin">👑 SUPER ADMIN (Full Control Access)</option>
                </select>
              </div>

              {editRoleData.role === 'owner' && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>ASSIGNED STALL</label>
                  <select 
                    value={editRoleData.shopId} 
                    onChange={e => setEditRoleData({ ...editRoleData, shopId: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    {SHOPS.map(shop => (
                      <option key={shop.id} value={shop.id}>{shop.name} ({shop.id})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <button 
                  type="button" onClick={() => setRoleEditUser(null)}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid #CBD5E1', background: '#F8FAFC', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={() => handleUpdateUserRole(roleEditUser, editRoleData.role, editRoleData.shopId)}
                  style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', background: '#2563EB', color: 'white', fontWeight: 800, fontFamily: "'Oswald', sans-serif", fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  CONFIRM ROLE CHANGE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
