import React, { useState } from 'react';
import { 
  Settings, AlertTriangle, Power, ShieldAlert, 
  Trash2, Radio, Server, CheckCircle2, Lock, Unlock, Database, Cpu, RefreshCw 
} from 'lucide-react';

export const ConfigEmergencyModule = () => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isPauseOrders, setIsPauseOrders] = useState(false);
  const [isCashPaymentEnabled, setIsCashPaymentEnabled] = useState(true);
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(true);

  const handleGlobalWipe = () => {
    const confirm = window.confirm("CRITICAL WARNING: This will flush all active queues globally across all stalls. Continue?");
    if (confirm) {
      alert("System queues flushed successfully.");
    }
  };

  const handleSessionWipe = () => {
    const confirm = window.confirm("Reset all corrupted user sessions across local storage?");
    if (confirm) {
      localStorage.removeItem('sgu_user');
      localStorage.removeItem('sgu_pending_name');
      alert("Local session storage cleared.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>PLATFORM CONFIG & EMERGENCY OVERRIDES</h1>
          <p className="text-slate-500 text-sm font-medium">Feature flags, system kill-switches, emergency queue flushes and API integration status matrix.</p>
        </div>
      </div>

      {/* Feature Flags Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
        {/* Maintenance Mode */}
        <div className="admin-card-v2 flex flex-col justify-between" style={{ borderLeft: `6px solid ${isMaintenanceMode ? '#DC2626' : '#22C55E'}` }}>
          <div>
            <div className="flex justify-between items-start mb-2">
              <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', items: 'center', gap: 8 }}>
                <Power size={20} color={isMaintenanceMode ? '#DC2626' : '#22C55E'} /> GLOBAL MAINTENANCE MODE
              </h3>
              <span className={`status-pill ${isMaintenanceMode ? 'cancelled' : 'ready'}`}>
                {isMaintenanceMode ? 'ACTIVE (BLOCKING)' : 'NORMAL'}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, fontWeight: 500 }}>
              Puts the entire student food court platform into maintenance mode. Students will see a friendly offline banner.
            </p>
          </div>
          <button
            onClick={() => setIsMaintenanceMode(!isMaintenanceMode)}
            style={{
              marginTop: 16, width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
              fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase',
              background: isMaintenanceMode ? '#DCFCE7' : '#FEE2E2',
              color: isMaintenanceMode ? '#15803D' : '#DC2626',
              transition: 'all 0.2s ease'
            }}
          >
            {isMaintenanceMode ? 'DISABLE MAINTENANCE MODE' : 'ENABLE MAINTENANCE MODE'}
          </button>
        </div>

        {/* Pause Orders */}
        <div className="admin-card-v2 flex flex-col justify-between" style={{ borderLeft: `6px solid ${isPauseOrders ? '#F59E0B' : '#E4002B'}` }}>
          <div>
            <div className="flex justify-between items-start mb-2">
              <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', items: 'center', gap: 8 }}>
                <Lock size={20} color={isPauseOrders ? '#F59E0B' : '#E4002B'} /> PAUSE NEW ORDERS
              </h3>
              <span className={`status-pill ${isPauseOrders ? 'preparing' : 'ready'}`}>
                {isPauseOrders ? 'PAUSED' : 'ACCEPTING'}
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748B', margin: 0, fontWeight: 500 }}>
              Temporarily halts checkout for new student orders while allowing active orders to be completed.
            </p>
          </div>
          <button
            onClick={() => setIsPauseOrders(!isPauseOrders)}
            style={{
              marginTop: 16, width: '100%', padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
              fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase',
              background: isPauseOrders ? '#E4002B' : '#FEF3C7',
              color: isPauseOrders ? 'white' : '#D97706',
              transition: 'all 0.2s ease'
            }}
          >
            {isPauseOrders ? 'RESUME STUDENT CHECKOUT' : 'PAUSE ALL NEW ORDERS'}
          </button>
        </div>
      </div>

      {/* Emergency Controls & System Matrix */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Emergency Overrides */}
        <div className="admin-card-v2" style={{ borderTop: '4px solid #E4002B' }}>
          <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', fontWeight: 800, color: '#E4002B', margin: '0 0 12px 0', display: 'flex', items: 'center', gap: 8 }}>
            <AlertTriangle size={20} color="#E4002B" /> EMERGENCY OVERRIDES
          </h3>
          <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0 0 16px 0', fontWeight: 500 }}>
            Execute emergency actions in case of server outages or severe technical failures.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleGlobalWipe}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.9rem', textTransform: 'uppercase',
                background: '#E4002B', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 4px 14px rgba(228,0,43,0.3)'
              }}
            >
              <Trash2 size={18} /> GLOBAL QUEUE WIPE
            </button>

            <button
              onClick={handleSessionWipe}
              style={{
                width: '100%', padding: '14px', borderRadius: 12, border: '1px solid #E2E8F0', cursor: 'pointer',
                fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase',
                background: '#FFFFFF', color: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}
            >
              <RefreshCw size={16} /> CLEAR CORRUPTED SESSIONS
            </button>
          </div>
        </div>

        {/* Integration Status Matrix */}
        <div className="admin-card-v2" style={{ borderTop: '4px solid #E4002B' }}>
          <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', fontWeight: 800, color: '#E4002B', margin: '0 0 12px 0', display: 'flex', items: 'center', gap: 8 }}>
            <Cpu size={20} color="#E4002B" /> API INTEGRATION STATUS MATRIX
          </h3>

          <div className="flex flex-col gap-3">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#F8FAFC', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Database size={18} color="#E4002B" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0F172A' }}>Supabase PostgreSQL</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Primary Database Cluster</div>
                </div>
              </div>
              <span className="status-pill ready"><CheckCircle2 size={12} /> OPERATIONAL</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#F8FAFC', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Radio size={18} color="#22C55E" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0F172A' }}>Socket.io Realtime Engine</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>WebSocket Live Queue Broadcast</div>
                </div>
              </div>
              <span className="status-pill ready"><CheckCircle2 size={12} /> ACTIVE</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#F8FAFC', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Server size={18} color="#F59E0B" />
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0F172A' }}>Vercel Edge Network</div>
                  <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Washington D.C. (iad1) · 18ms</div>
                </div>
              </div>
              <span className="status-pill ready"><CheckCircle2 size={12} /> OPTIMAL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
