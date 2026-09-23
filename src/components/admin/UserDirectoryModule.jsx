import React, { useState, useEffect } from 'react';
import {
  Users, Search, RefreshCw, UserCheck, UserX, Plus, Shield
} from 'lucide-react';
import { api } from '../../api';
import { addAuditLog } from '../../utils/logger';
import { useCart } from '../../context/CartContext';

export const UserDirectoryModule = () => {
  const { showToast } = useCart();
  const [users, setUsers] = useState([]);
  const [stalls, setStalls] = useState([]);
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
      const [dbUsers, stallList] = await Promise.all([api.getAdminUsers(), api.getStalls()]);
      setUsers(Array.isArray(dbUsers) ? dbUsers : []);
      setStalls(Array.isArray(stallList) ? stallList : []);
    } catch (err) {
      console.error('Failed to load user directory:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    const email = formData.email.trim().toLowerCase();
    if (!email || !email.includes('@')) { alert('Please enter a valid email address.'); return; }
    if (formData.role === 'vendor' && !formData.shopId) { alert('Select a stall for the vendor role.'); return; }

    setIsSubmitting(true);
    try {
      const res = await api.manageUser({
        action: 'create', email, role: formData.role,
        shopId: formData.role === 'vendor' ? formData.shopId : null,
        fullName: formData.name.trim()
      });
      addAuditLog({ level: 'SECURITY', category: 'Auth', message: `User '${email}' (${formData.role.toUpperCase()}) provisioned by admin` });
      alert(`User created.\nEmail: ${email}\nTemporary password (share securely): ${res.tempPassword}`);
      setShowAddModal(false);
      setFormData({ email: '', name: '', role: 'student', shopId: '' });
      await loadUsers();
    } catch (err) {
      alert('Failed to create user: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdateUserRole(targetUser, newRole, targetShopId) {
    const email = (targetUser.username || targetUser.email || '').toLowerCase();
    if (!email || !email.includes('@')) { alert('This account has no email and cannot be modified.'); return; }
    if (targetUser.role === newRole && (targetShopId === undefined || targetShopId === targetUser.shopId)) { setRoleEditUser(null); return; }

    const effectiveShopId = newRole === 'vendor' ? (targetShopId || targetUser.shopId || (stalls[0] && stalls[0].id)) : null;
    if (newRole === 'vendor' && !effectiveShopId) { alert('Select a stall for the vendor role.'); return; }
    if (!window.confirm(`Change role of ${targetUser.name || email} to ${newRole.toUpperCase()}?`)) return;

    try {
      await api.manageUser({ action: 'set-role', email, role: newRole, shopId: effectiveShopId });
      addAuditLog({ level: 'SECURITY', category: 'RBAC', message: `Role for '${email}' set to ${newRole.toUpperCase()}` });
      setRoleEditUser(null);
      await loadUsers();
    } catch (err) {
      alert('Failed to update role: ' + err.message);
    }
  }

  async function handleToggleUserStatus(user) {
    const email = (user.username || user.email || '').toLowerCase();
    if (!email || !email.includes('@')) { alert('This account has no email and cannot be modified.'); return; }
    const nextStatus = user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    if (!window.confirm(`${nextStatus === 'SUSPENDED' ? 'Suspend' : 'Reactivate'} ${email}?`)) return;

    try {
      await api.manageUser({ action: 'set-status', email, status: nextStatus });
      addAuditLog({ level: 'SECURITY', category: 'Auth', message: `User '${email}' status set to ${nextStatus}` });
      await loadUsers();
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  }

  const openEditRoleModal = (user) => {
    setRoleEditUser(user);
    setEditRoleData({
      role: user.role || 'student',
      shopId: user.shopId || (stalls[0] && stalls[0].id) || ''
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
            <option value="vendor">VENDOR OWNER</option>
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
                            background: currentRole === 'admin' ? '#FFE4E6' : currentRole === 'vendor' ? '#FEF3C7' : '#F1F5F9',
                            color: currentRole === 'admin' ? '#E11D48' : currentRole === 'vendor' ? '#D97706' : '#475569',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <option value="student">🎓 STUDENT</option>
                          <option value="vendor">🏪 VENDOR OWNER</option>
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
                            title={isSuspended ? 'Reactivate User Account' : 'Suspend User Account'}
                            style={{ 
                              width: 34, height: 34, borderRadius: 10, 
                              border: isSuspended ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)', 
                              background: isSuspended ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
                              color: isSuspended ? '#059669' : '#DC2626', 
                              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease' 
                            }}
                            onClick={() => handleToggleUserStatus(user)}
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
                  <option value="vendor">🏪 VENDOR OWNER (STALL MANAGER)</option>
                  <option value="admin">👑 SUPER ADMIN (SYSTEM OVERSEER)</option>
                </select>
              </div>

              {formData.role === 'vendor' && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>ASSIGNED STALL *</label>
                  <select 
                    value={formData.shopId} 
                    onChange={e => setFormData({ ...formData, shopId: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <option value="">Select Food Court Stall...</option>
                    {stalls.map(shop => (
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
                  <option value="vendor">🏪 VENDOR OWNER (Stall Management Access)</option>
                  <option value="admin">👑 SUPER ADMIN (Full Control Access)</option>
                </select>
              </div>

              {editRoleData.role === 'vendor' && (
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: 4 }}>ASSIGNED STALL</label>
                  <select 
                    value={editRoleData.shopId} 
                    onChange={e => setEditRoleData({ ...editRoleData, shopId: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    {stalls.map(shop => (
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
