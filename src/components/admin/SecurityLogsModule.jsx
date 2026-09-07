import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, RefreshCw, Download, Search, Filter, 
  Info, AlertTriangle, AlertCircle, ShieldCheck, Terminal,
  Play, Pause, Trash2, Eye
} from 'lucide-react';
import { 
  getStoredLogs, 
  subscribeRealtimeLogs, 
  generateRandomTraceLog, 
  clearAuditLogs,
  addAuditLog 
} from '../../utils/logger';
import { adminApi } from '../../utils/adminApi';

export const SecurityLogsModule = () => {
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);

  useEffect(() => {
    setLogs(getStoredLogs());

    const unsubscribe = subscribeRealtimeLogs(
      (newLog) => {
        setLogs(prev => [newLog, ...prev.filter(l => l.id !== newLog.id)]);
      },
      (cleared) => setLogs(cleared)
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      generateRandomTraceLog();
    }, 5000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sgu_audit_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Level', 'Category', 'Message'];
    const rows = logs.map(l => [`"${l.timestamp}"`, `"${l.level}"`, `"${l.category}"`, `"${l.message.replace(/"/g, '""')}"`]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `sgu_audit_logs_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredLogs = logs.filter(l => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery = !q || l.message.toLowerCase().includes(q) || (l.category && l.category.toLowerCase().includes(q)) || (l.userEmail && l.userEmail.toLowerCase().includes(q));
    const matchLevel = logFilter === 'ALL' || l.level === logFilter;
    return matchQuery && matchLevel;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>SECURITY ACCESS & AUDIT LOGS</h1>
          <p className="text-slate-500 text-sm font-medium">Append-only operational traces, security access events, DB queries and auth logs.</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => setIsStreaming(!isStreaming)}
            className="btn-action-sm"
            style={{ 
              display: 'flex', alignItems: 'center', gap: 6,
              background: isStreaming ? '#FFF1F2' : '#F0FDF4',
              borderColor: isStreaming ? '#FECDD3' : '#BBF7D0',
              color: isStreaming ? '#E11D48' : '#15803D', fontWeight: 700
            }}
          >
            {isStreaming ? <Pause size={14} /> : <Play size={14} />} 
            {isStreaming ? 'Pause Stream' : 'Resume Stream'}
          </button>
          
          <button 
            onClick={handleExportJSON}
            className="btn-action-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: '#1A5276', color: '#1A5276' }}
          >
            <Download size={14} /> Export JSON
          </button>

          <button 
            onClick={handleExportCSV}
            className="btn-action-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="admin-card-v2 flex flex-col gap-4">
        {/* Controls Deck */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 280, maxWidth: 400 }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search audit log entries..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10,
                border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.85rem', fontWeight: 600
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['ALL', 'INFO', 'WARN', 'SECURITY', 'ERROR'].map(lvl => (
              <button
                key={lvl}
                onClick={() => setLogFilter(lvl)}
                style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontFamily: "'Oswald', sans-serif", fontWeight: 800, fontSize: '0.75rem',
                  background: logFilter === lvl ? '#1A5276' : '#F1F5F9',
                  color: logFilter === lvl ? 'white' : '#64748B',
                  transition: 'all 0.2s ease'
                }}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* High-density Enterprise Table */}
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '110px' }}>Timestamp</th>
                <th style={{ width: '90px' }}>Level</th>
                <th style={{ width: '100px' }}>Category</th>
                <th style={{ width: '190px' }}>User Email</th>
                <th>Event Message</th>
                <th style={{ textAlign: 'right', width: '70px' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
                    No audit log events matching filter &quot;{logFilter}&quot;.
                  </td>
                </tr>
              ) : (
                filteredLogs.slice(0, 100).map(log => {
                  const badgeColor = log.level === 'SECURITY' ? '#F43F5E' : log.level === 'WARN' ? '#F59E0B' : log.level === 'ERROR' ? '#EF4444' : '#0EA5E9';
                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.78rem', color: '#64748B', fontFamily: 'monospace' }}>
                        [{log.timestamp}]
                      </td>
                      <td>
                        <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 6, color: badgeColor, background: `${badgeColor}15`, border: `1px solid ${badgeColor}30`, fontFamily: "'Oswald', sans-serif" }}>
                          {log.level}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1A5276' }}>
                        {log.category || 'System'}
                      </td>
                      <td style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                        {log.userEmail || 'system@sgu.edu'}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#0F172A', fontWeight: 500 }}>
                        {log.message}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn-action-sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Event Details Drawer Modal */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
          <div className="admin-card-v2" style={{ maxWidth: 520, width: '100%', padding: 24, background: '#FFFFFF', borderRadius: 20 }}>
            <div className="flex justify-between items-center mb-4">
              <h3 style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                AUDIT LOG EVENT DETAILS
              </h3>
              <button onClick={() => setSelectedLog(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>✕</button>
            </div>
            <div style={{ background: '#0E2F44', color: '#E2E8F0', padding: 16, borderRadius: 12, fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(selectedLog, null, 2)}
            </div>
            <button 
              onClick={() => setSelectedLog(null)}
              style={{ marginTop: 16, width: '100%', padding: 10, borderRadius: 10, border: 'none', background: '#FF3B5C', color: 'white', fontWeight: 800, cursor: 'pointer' }}
            >
              Close Details
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
