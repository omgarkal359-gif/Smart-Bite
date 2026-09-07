import React, { useState, useEffect } from 'react';
import { 
  Users, Lock, ShieldCheck, RefreshCw, Check, X, Radio
} from 'lucide-react';
import { adminApi } from '../../utils/adminApi';
import { addAuditLog } from '../../utils/logger';
import { supabase } from '../../supabaseClient';

const ALL_PERMISSIONS = [
  { id: 'orders:read', label: 'View Campus Orders', group: 'Orders' },
  { id: 'orders:write', label: 'Modify / Process Orders', group: 'Orders' },
  { id: 'menu:read', label: 'View Menu Items', group: 'Menu' },
  { id: 'menu:write', label: 'Edit / Price Menu Items', group: 'Menu' },
  { id: 'vendors:manage', label: 'Manage Vendor Stalls', group: 'Administration' },
  { id: 'users:manage', label: 'Manage Users & Permissions', group: 'Administration' },
  { id: 'audit:read', label: 'Access Audit Logs', group: 'Security' },
  { id: 'system:backup', label: 'Trigger Database Backups', group: 'System' },
  { id: 'system:recovery', label: 'Trigger Disaster Recovery Sync', group: 'System' }
];

export const RolesModule = () => {
  const [roles, setRoles] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [updatingRole, setUpdatingRole] = useState(null);

  useEffect(() => {
    loadRoles();

    // 1. Local DOM event listener for instant single-window real-time reactivity
    const handleLocalRbacUpdate = (e) => {
      if (e.detail && e.detail.role && e.detail.permissions) {
        setRoles(prev => ({ ...prev, [e.detail.role]: e.detail.permissions }));
      }
    };
    window.addEventListener('sgu:rbac_updated', handleLocalRbacUpdate);

    // 2. Supabase Realtime Channel Subscription for multi-client/browser tab sync
    const channel = supabase
      .channel('admin-rbac-module-sub')
      .on('broadcast', { event: 'rbac_updated' }, (payload) => {
        if (payload.payload && payload.payload.role && payload.payload.permissions) {
          setRoles(prev => ({ ...prev, [payload.payload.role]: payload.payload.permissions }));
        }
      })
      .subscribe();

    return () => {
      window.removeEventListener('sgu:rbac_updated', handleLocalRbacUpdate);
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadRoles() {
    setIsLoading(true);
    try {
      const res = await adminApi.getRoles();
      setRoles(res.roles || {});
    } catch (err) {
      console.error('Failed to load roles matrix:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleTogglePermission(role, permId) {
    // Security protection: Admin users:manage cannot be disabled
    if (role === 'admin' && permId === 'users:manage') {
      alert('Security Protection: Admin users:manage privilege cannot be disabled.');
      return;
    }

    const currentPerms = roles[role] || [];
    const isGranted = currentPerms.includes(permId);
    const updatedPermissions = isGranted
      ? currentPerms.filter(p => p !== permId)
      : [...currentPerms, permId];

    // Optimistic Instant UI State Update (Zero Delay)
    setRoles(prev => ({ ...prev, [role]: updatedPermissions }));
    setUpdatingRole(`${role}:${permId}`);

    try {
      await adminApi.updateRolePermissions(role, updatedPermissions);
      
      addAuditLog({
        level: 'SECURITY',
        category: 'Auth',
        message: `RBAC permission '${permId}' for role '${role}' ${isGranted ? 'DISABLED' : 'ENABLED'} by Super Admin`
      });
    } catch (err) {
      console.error('Auto-save RBAC failed:', err);
      loadRoles();
    } finally {
      setTimeout(() => setUpdatingRole(null), 300);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>ROLE-BASED ACCESS CONTROL (RBAC)</h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 20,
              background: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              color: '#15803D',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.04em'
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#22C55E',
                boxShadow: '0 0 8px #22C55E',
                animation: 'pulse 1.5s infinite'
              }} />
              REAL-TIME AUTO-SYNC ACTIVE
            </span>
          </div>
          <p className="text-slate-500 text-sm font-medium mt-1">Manage permission matrix across admin, vendor, student, and support user roles with instant real-time auto-saving.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={loadRoles}
            className="btn-action-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh Matrix
          </button>
        </div>
      </div>

      {/* Permissions Matrix Card */}
      <div className="admin-card-v2 flex flex-col gap-4">
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Permission Capability</th>
                <th style={{ textAlign: 'center' }}>Admin</th>
                <th style={{ textAlign: 'center' }}>Vendor Owner</th>
                <th style={{ textAlign: 'center' }}>Student</th>
                <th style={{ textAlign: 'center' }}>Support Staff</th>
              </tr>
            </thead>
            <tbody>
              {ALL_PERMISSIONS.map(perm => (
                <tr key={perm.id}>
                  <td>
                    <div style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.85rem' }}>{perm.label}</div>
                    <div style={{ fontSize: '0.7rem', color: '#64748B', fontFamily: 'monospace' }}>{perm.id} · ({perm.group})</div>
                  </td>

                  {['admin', 'vendor', 'student', 'support'].map(role => {
                    const isGranted = (roles[role] || []).includes(perm.id);
                    const isTargetUpdating = updatingRole === `${role}:${perm.id}`;

                    return (
                      <td key={role} style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleTogglePermission(role, perm.id)}
                          style={{
                            padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            fontWeight: 800, fontSize: '0.75rem', fontFamily: "'Oswald', sans-serif",
                            background: isGranted ? '#DCFCE7' : '#F1F5F9',
                            color: isGranted ? '#15803D' : '#94A3B8',
                            boxShadow: isGranted ? '0 2px 8px rgba(34, 197, 94, 0.2)' : 'none',
                            transform: isTargetUpdating ? 'scale(0.95)' : 'scale(1)',
                            transition: 'all 0.15s ease'
                          }}
                          title={`Click to ${isGranted ? 'disable' : 'enable'} ${perm.id} for ${role}`}
                        >
                          {isGranted ? 'ENABLED' : 'DISABLED'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
