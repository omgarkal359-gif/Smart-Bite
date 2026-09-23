import React, { useState, useEffect } from 'react';
import {
  AlertTriangle, Power, Lock, Banknote, Smartphone,
  Trash2, RefreshCw, Loader2, Percent, IndianRupee, Save
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
  const [fees, setFees] = useState(null);       // editable fee draft
  const [feeSaving, setFeeSaving] = useState(false);
  const [feeMsg, setFeeMsg] = useState('');

  useEffect(() => {
    let active = true;
    api.getPlatformConfig()
      .then(c => {
        if (!active) return;
        setConfig(c);
        setFees({
          commission_type: c.commission_type || 'percent',
          commission_percent: c.commission_percent ?? 10,
          commission_flat: c.commission_flat ?? 0,
          convenience_fee_enabled: c.convenience_fee_enabled ?? false,
          convenience_fee: c.convenience_fee ?? 0
        });
      })
      .catch(() => { if (active) setError('Failed to load platform config.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const saveFees = async () => {
    setFeeSaving(true);
    setFeeMsg('');
    try {
      const patch = {
        commission_type: fees.commission_type,
        commission_percent: Number(fees.commission_percent) || 0,
        commission_flat: Number(fees.commission_flat) || 0,
        convenience_fee_enabled: !!fees.convenience_fee_enabled,
        convenience_fee: Number(fees.convenience_fee) || 0
      };
      const updated = await api.updatePlatformConfig(patch);
      if (updated) setConfig(updated);
      addAuditLog({ level: 'SECURITY', category: 'System', message: `Platform fees updated (commission ${patch.commission_type} ${patch.commission_percent}% / ₹${patch.commission_flat}; convenience ${patch.convenience_fee_enabled ? '₹' + patch.convenience_fee : 'off'})` });
      setFeeMsg('Saved. Applies to new orders.');
    } catch (e) {
      setFeeMsg(e.message || 'Failed to save fees.');
    } finally {
      setFeeSaving(false);
    }
  };

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

      {/* Platform fees: commission (from vendor) + convenience fee (to customer) */}
      {fees && (
        <div className="admin-card-v2" style={{ borderTop: '4px solid #6366F1', maxWidth: 640 }}>
          <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IndianRupee size={20} color="#6366F1" /> PLATFORM FEES
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 16px 0', fontWeight: 500 }}>
            Commission is deducted from the vendor. Convenience fee is added to the customer’s bill. Both apply to <b>new</b> orders only.
          </p>

          {/* Commission */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Percent size={14} /> Commission (from vendor)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: '#64748B' }}>
                TYPE
                <select value={fees.commission_type}
                  onChange={e => setFees({ ...fees, commission_type: e.target.value })}
                  style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid #E2E8F0', fontWeight: 700, fontSize: '0.85rem' }}>
                  <option value="percent">Percent (%)</option>
                  <option value="flat">Flat (₹)</option>
                  <option value="both">Both (% + ₹)</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: '#64748B', opacity: fees.commission_type === 'flat' ? 0.4 : 1 }}>
                PERCENT %
                <input type="number" min="0" step="0.1" value={fees.commission_percent}
                  disabled={fees.commission_type === 'flat'}
                  onChange={e => setFees({ ...fees, commission_percent: e.target.value })}
                  style={{ width: 110, padding: '8px 10px', borderRadius: 10, border: '1px solid #E2E8F0', fontWeight: 700, fontSize: '0.85rem' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: '#64748B', opacity: fees.commission_type === 'percent' ? 0.4 : 1 }}>
                FLAT ₹
                <input type="number" min="0" step="0.01" value={fees.commission_flat}
                  disabled={fees.commission_type === 'percent'}
                  onChange={e => setFees({ ...fees, commission_flat: e.target.value })}
                  style={{ width: 110, padding: '8px 10px', borderRadius: 10, border: '1px solid #E2E8F0', fontWeight: 700, fontSize: '0.85rem' }} />
              </label>
            </div>
          </div>

          {/* Convenience fee */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IndianRupee size={14} /> Convenience fee (to customer, per order)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', fontWeight: 700, color: '#334155' }}>
                <input type="checkbox" checked={!!fees.convenience_fee_enabled}
                  onChange={e => setFees({ ...fees, convenience_fee_enabled: e.target.checked })}
                  style={{ width: 18, height: 18 }} />
                Enable global convenience fee
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: '#64748B', opacity: fees.convenience_fee_enabled ? 1 : 0.4 }}>
                AMOUNT ₹
                <input type="number" min="0" step="0.01" value={fees.convenience_fee}
                  disabled={!fees.convenience_fee_enabled}
                  onChange={e => setFees({ ...fees, convenience_fee: e.target.value })}
                  style={{ width: 110, padding: '8px 10px', borderRadius: 10, border: '1px solid #E2E8F0', fontWeight: 700, fontSize: '0.85rem' }} />
              </label>
            </div>
            <p style={{ fontSize: '0.72rem', color: '#94A3B8', margin: '8px 0 0 0' }}>
              Per-vendor and per-item overrides take precedence over this global setting.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={saveFees} disabled={feeSaving}
              style={{ padding: '10px 20px', borderRadius: 12, border: 'none', cursor: feeSaving ? 'wait' : 'pointer', fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', background: '#6366F1', color: 'white', display: 'flex', alignItems: 'center', gap: 8, opacity: feeSaving ? 0.6 : 1 }}>
              <Save size={16} /> {feeSaving ? 'Saving…' : 'Save fees'}
            </button>
            {feeMsg && <span style={{ fontSize: '0.8rem', fontWeight: 700, color: feeMsg.startsWith('Saved') ? '#15803D' : '#DC2626' }}>{feeMsg}</span>}
          </div>
        </div>
      )}

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
