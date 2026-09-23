import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, Power, Lock, Banknote, Smartphone,
  Trash2, RefreshCw, Loader2
} from 'lucide-react';
import { api } from '../../api';
import { supabase } from '../../supabaseClient';
import { clearStoredUser } from '../../utils/auth';
import { addAuditLog } from '../../utils/logger';

const ACTIVE_STATUSES = ['placed', 'pending_cash', 'preparing', 'ready'];

export const ConfigEmergencyModule = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.getPlatformConfig()
      .then(c => { if (active) setConfig(c); })
      .catch(() => { if (active) setError('Failed to load platform config.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const toggle = async (key, auditMsg) => {
    if (!config) return;
    const next = !config[key];
    setSavingKey(key);
    setError('');
    try {
      const updated = await api.updatePlatformConfig({ [key]: next });
      setConfig(updated || { ...config, [key]: next });
      addAuditLog({ level: 'SECURITY', category: 'System', message: auditMsg(next) });
    } catch (e) {
      setError(e.message || 'Failed to update config.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleGlobalCancel = async () => {
    if (!window.confirm('Cancel ALL active orders (placed/preparing/ready) across every stall? This cannot be undone.')) return;
    try {
      const { error: e } = await supabase
        .from('orders')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .in('status', ACTIVE_STATUSES);
      if (e) throw new Error(e.message);
      addAuditLog({ level: 'SECURITY', category: 'Orders', message: 'EMERGENCY: all active orders cancelled by admin' });
      alert('All active orders have been cancelled.');
    } catch (e) {
      setError(e.message || 'Failed to cancel active orders.');
    }
  };

  const handleSessionWipe = () => {
    if (!window.confirm('Clear this device’s stored login session and local caches?')) return;
    clearStoredUser();
    try { localStorage.removeItem('sgu_pending_name'); } catch (_e) {}
    addAuditLog({ level: 'WARN', category: 'Auth', message: 'Admin cleared local session storage on this device' });
    alert('Local session storage cleared on this device.');
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-slate-500 font-semibold p-6"><Loader2 className="animate-spin" size={18} /> Loading platform config…</div>;
  }

  const flags = [
    { key: 'maintenance_mode', icon: Power, title: 'GLOBAL MAINTENANCE MODE', desc: 'Blocks new orders platform-wide while active.', onLabel: 'ACTIVE (BLOCKING)', offLabel: 'NORMAL', danger: true,
      audit: (v) => `Maintenance Mode ${v ? 'ENABLED' : 'DISABLED'}` },
    { key: 'pause_orders', icon: Lock, title: 'PAUSE NEW ORDERS', desc: 'Halts checkout for new orders; active orders still complete.', onLabel: 'PAUSED', offLabel: 'ACCEPTING', danger: true,
      audit: (v) => `New orders ${v ? 'PAUSED' : 'RESUMED'}` },
    { key: 'allow_cash', icon: Banknote, title: 'CASH PAYMENTS', desc: 'Allow students to choose cash at checkout.', onLabel: 'ENABLED', offLabel: 'DISABLED', invert: true,
      audit: (v) => `Cash payments ${v ? 'ENABLED' : 'DISABLED'}` },
    { key: 'allow_online', icon: Smartphone, title: 'ONLINE (UPI) PAYMENTS', desc: 'Allow students to choose online/UPI at checkout.', onLabel: 'ENABLED', offLabel: 'DISABLED', invert: true,
      audit: (v) => `Online payments ${v ? 'ENABLED' : 'DISABLED'}` }
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>PLATFORM CONFIG & EMERGENCY OVERRIDES</h1>
        <p className="text-slate-500 text-sm font-medium">Live feature flags stored in Supabase and enforced at checkout.</p>
      </div>

      {error && <div className="status-pill cancelled" style={{ alignSelf: 'flex-start' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {flags.map(f => {
          const on = !!config[f.key];
          // For "allow_*" flags, ON (enabled) is the healthy/green state; for
          // maintenance/pause, ON is the blocking/red state.
          const isHealthy = f.invert ? on : !on;
          const accent = isHealthy ? '#22C55E' : (f.danger ? '#DC2626' : '#F59E0B');
          const Icon = f.icon;
          const saving = savingKey === f.key;
          return (
            <div key={f.key} className="admin-card-v2 flex flex-col justify-between" style={{ borderLeft: `6px solid ${accent}` }}>
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon size={20} color={accent} /> {f.title}
                  </h3>
                  <span className={`status-pill ${isHealthy ? 'ready' : (f.danger ? 'cancelled' : 'preparing')}`}>
                    {on ? f.onLabel : f.offLabel}
                  </span>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, fontWeight: 500 }}>{f.desc}</p>
              </div>
              <button
                onClick={() => toggle(f.key, f.audit)}
                disabled={saving}
                style={{
                  marginTop: 16, width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                  cursor: saving ? 'wait' : 'pointer', fontFamily: "'Oswald', sans-serif", fontWeight: 800,
                  fontSize: '0.85rem', textTransform: 'uppercase', opacity: saving ? 0.6 : 1,
                  background: isHealthy ? '#FEE2E2' : '#DCFCE7', color: isHealthy ? '#DC2626' : '#15803D'
                }}
              >
                {saving ? 'Saving…' : (f.invert ? (on ? 'Disable' : 'Enable') : (on ? 'Turn off' : 'Turn on'))}
              </button>
            </div>
          );
        })}
      </div>

      {/* Emergency actions (real) */}
      <div className="admin-card-v2" style={{ borderTop: '4px solid #FF3B5C', maxWidth: 480 }}>
        <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', fontWeight: 800, color: '#FF3B5C', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={20} color="#FF3B5C" /> EMERGENCY OVERRIDES
        </h3>
        <div className="flex flex-col gap-3">
          <button onClick={handleGlobalCancel}
            style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase', background: '#FF3B5C', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Trash2 size={18} /> Cancel all active orders
          </button>
          <button onClick={handleSessionWipe}
            style={{ width: '100%', padding: '14px', borderRadius: 12, border: '1px solid #E2E8F0', cursor: 'pointer', fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', background: '#FFFFFF', color: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <RefreshCw size={16} /> Clear this device’s session
          </button>
        </div>
      </div>
    </div>
  );
};
