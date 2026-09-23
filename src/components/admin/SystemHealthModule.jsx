import React, { useState, useEffect } from 'react';
import { Database, Radio, RefreshCw, Users, ShoppingBag, Store, UtensilsCrossed, ScrollText } from 'lucide-react';
import { api } from '../../api';
import { supabase } from '../../supabaseClient';

export const SystemHealthModule = () => {
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState('CHECKING'); // ONLINE | OFFLINE | CHECKING

  useEffect(() => {
    loadHealth();
  }, []);

  // Live Realtime probe: subscribe once and report the channel state.
  useEffect(() => {
    setRealtimeStatus('CHECKING');
    const channel = supabase.channel('admin-health-probe')
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('ONLINE');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setRealtimeStatus('OFFLINE');
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadHealth() {
    setIsLoading(true);
    try {
      const res = await api.getSystemHealth();
      setHealth(res);
    } catch (err) {
      console.error('Failed to load system health metrics:', err);
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  }

  const db = health?.database || { status: 'DEGRADED', reachable: false, latencyMs: null };
  const counts = health?.counts || {};

  const countCards = [
    { key: 'accounts', label: 'User Accounts', icon: Users, color: '#1A5276' },
    { key: 'orders', label: 'Orders', icon: ShoppingBag, color: '#E4002B' },
    { key: 'stalls', label: 'Stalls', icon: Store, color: '#8B5CF6' },
    { key: 'menu_items', label: 'Menu Items', icon: UtensilsCrossed, color: '#F59E0B' },
    { key: 'audit_logs', label: 'Audit Log Entries', icon: ScrollText, color: '#0EA5E9' },
  ];

  const dbOk = db.status === 'OPERATIONAL';
  const rtOk = realtimeStatus === 'ONLINE';

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>SYSTEM HEALTH</h1>
          <p className="text-slate-500 text-sm font-medium">
            Measured PostgreSQL round-trip latency, live Realtime channel status, and current row counts.
          </p>
        </div>
        <button
          onClick={loadHealth}
          className="btn-action-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Core services */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {/* Database */}
        <div className="admin-card-v2 flex flex-col justify-between" style={{ borderTop: `4px solid ${dbOk ? '#22C55E' : '#EF4444'}` }}>
          <div>
            <div className="flex justify-between items-start mb-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0F172A', fontWeight: 800 }}>
                <Database size={20} color={dbOk ? '#22C55E' : '#EF4444'} /> PostgreSQL Database
              </div>
              <span className="status-pill ready" style={!dbOk ? { background: '#FEE2E2', color: '#B91C1C' } : undefined}>
                {db.status}
              </span>
            </div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '2rem', fontWeight: 800, color: '#0F172A', margin: '8px 0 4px 0' }}>
              {isLoading ? '…' : (db.latencyMs != null ? db.latencyMs : '—')} <span style={{ fontSize: '1rem', color: '#64748B' }}>ms round-trip</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>
              Supabase managed PostgreSQL {db.reachable ? '· reachable' : '· unreachable'}
            </p>
          </div>
        </div>

        {/* Realtime */}
        <div className="admin-card-v2 flex flex-col justify-between" style={{ borderTop: `4px solid ${rtOk ? '#0EA5E9' : '#EF4444'}` }}>
          <div>
            <div className="flex justify-between items-start mb-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#0F172A', fontWeight: 800 }}>
                <Radio size={20} color={rtOk ? '#0EA5E9' : '#EF4444'} /> Supabase Realtime
              </div>
              <span className="status-pill ready" style={!rtOk ? { background: '#FEE2E2', color: '#B91C1C' } : undefined}>
                {realtimeStatus === 'CHECKING' ? 'CHECKING' : (rtOk ? 'ONLINE' : 'OFFLINE')}
              </span>
            </div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', fontWeight: 800, color: rtOk ? '#0EA5E9' : '#EF4444', margin: '12px 0 4px 0' }}>
              {rtOk ? 'Channel Subscribed' : (realtimeStatus === 'CHECKING' ? 'Connecting…' : 'Disconnected')}
            </div>
            <p style={{ fontSize: '0.78rem', color: '#64748B', margin: 0 }}>
              Postgres Changes &amp; Broadcast subscriptions
            </p>
          </div>
        </div>
      </div>

      {/* Live row counts */}
      <div>
        <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: '0 0 12px 0' }}>
          LIVE DATA COUNTS
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          {countCards.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="admin-card-v2" style={{ borderLeft: `4px solid ${color}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#64748B', fontWeight: 700, fontSize: '0.78rem' }}>
                <Icon size={16} color={color} /> {label}
              </div>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.8rem', fontWeight: 800, color: '#0F172A', marginTop: 6 }}>
                {isLoading ? '…' : (counts[key] != null ? counts[key].toLocaleString() : '—')}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
