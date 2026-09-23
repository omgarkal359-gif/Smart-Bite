import React, { useState } from 'react';
import { Database, Download, ShieldCheck, Clock, ExternalLink } from 'lucide-react';
import { api } from '../../api';
import { addAuditLog } from '../../utils/logger';

export const BackupsModule = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [lastExport, setLastExport] = useState(null);

  async function handleExport() {
    setIsExporting(true);
    try {
      const res = await api.exportData();
      const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `smartbite-export-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const total = Object.values(res.counts || {}).reduce((s, n) => s + (Number(n) || 0), 0);
      setLastExport({ at: res.generatedAt || new Date().toISOString(), counts: res.counts || {}, total });
      addAuditLog({
        level: 'SECURITY',
        category: 'System',
        message: `Full data export downloaded by Super Admin (${total} rows across ${Object.keys(res.counts || {}).length} tables)`
      });
    } catch (err) {
      alert('Data export failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>BACKUPS & DATA EXPORT</h1>
          <p className="text-slate-500 text-sm font-medium">
            Point-in-time backups are handled by the Supabase platform. Use Data Export for an on-demand full snapshot.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={isExporting}
          className="btn-action-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1A5276', color: 'white', borderColor: '#1A5276', fontWeight: 800 }}
        >
          <Download size={14} /> {isExporting ? 'EXPORTING…' : 'EXPORT DATA (JSON)'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Managed platform backups (honest, not fabricated) */}
        <div className="admin-card-v2" style={{ borderTop: '4px solid #22C55E' }}>
          <div className="flex justify-between items-start mb-3">
            <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={20} color="#22C55E" /> MANAGED BACKUPS
            </h3>
            <span className="status-pill ready">PLATFORM</span>
          </div>
          <p style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1E293B', margin: '0 0 10px 0', lineHeight: 1.5 }}>
            Automated database backups and Point-in-Time Recovery are managed by Supabase and are
            configured &amp; restored from the Supabase project dashboard — not from this app.
          </p>
          <a
            href="https://supabase.com/dashboard/project/hmdewtmtxgfyunyypcon/database/backups"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 800, color: '#1A5276', textDecoration: 'none' }}
          >
            Open Supabase Backups <ExternalLink size={14} />
          </a>
        </div>

        {/* On-demand export */}
        <div className="admin-card-v2" style={{ borderTop: '4px solid #1A5276' }}>
          <div className="flex justify-between items-start mb-3">
            <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Database size={20} color="#1A5276" /> ON-DEMAND EXPORT
            </h3>
          </div>
          <p style={{ fontSize: '0.82rem', color: '#64748B', margin: '0 0 12px 0', lineHeight: 1.5 }}>
            Downloads a full JSON snapshot of core tables (accounts, orders, order items, stalls,
            menu items, vendors, audit logs) generated server-side with the service-role key.
          </p>
          {lastExport ? (
            <div style={{ padding: 12, background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#15803D', fontWeight: 800 }}>
                <Clock size={13} /> Last export: {new Date(lastExport.at).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 700, marginTop: 4 }}>
                {lastExport.total.toLocaleString()} rows exported
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: 0, fontStyle: 'italic' }}>
              No export run in this session yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
