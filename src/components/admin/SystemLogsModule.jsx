import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldAlert, RefreshCw, Download, Search, Filter, 
  Info, AlertTriangle, AlertCircle, ShieldCheck, Terminal,
  Play, Pause, Trash2, Radio
} from 'lucide-react';
import { 
  getStoredLogs, 
  subscribeRealtimeLogs, 
  generateRandomTraceLog, 
  clearAuditLogs,
  addAuditLog 
} from '../../utils/logger';

export const SystemLogsModule = () => {
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [isLivePulse, setIsLivePulse] = useState(false);
  const terminalEndRef = useRef(null);

  // Load initial logs & setup real-time subscription + stream generator
  useEffect(() => {
    // 1. Initial load from persistent storage
    setLogs(getStoredLogs());

    // 2. Real-time subscription to local & Supabase Realtime broadcast events
    const unsubscribe = subscribeRealtimeLogs(
      (newLog) => {
        setLogs(prev => {
          // Avoid duplicate log IDs
          if (prev.some(l => l.id === newLog.id)) return prev;
          return [newLog, ...prev];
        });
        // Trigger visual pulse effect on new log arrival
        setIsLivePulse(true);
        setTimeout(() => setIsLivePulse(false), 600);
      },
      (cleared) => {
        setLogs(cleared);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  // Background streaming ticker (generates live trace telemetry every 4.5 seconds when active)
  useEffect(() => {
    if (!isStreaming) return;

    const interval = setInterval(() => {
      generateRandomTraceLog();
    }, 4500);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const handleRefresh = () => {
    // Force a fresh system status log and sync from storage
    addAuditLog({
      level: 'INFO',
      category: 'System',
      message: 'Manual audit stream refresh triggered by Super Admin'
    });
    setLogs(getStoredLogs());
  };

  const handleClearLogs = () => {
    if (window.confirm('Are you sure you want to reset the system audit logs?')) {
      const reset = clearAuditLogs();
      setLogs(reset);
    }
  };

  const handleExportLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `sgu_smartbite_audit_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredLogs = logs.filter(l => {
    const q = searchQuery.toLowerCase().trim();
    const matchQuery = !q || (l.message && l.message.toLowerCase().includes(q)) || (l.category && l.category.toLowerCase().includes(q)) || (l.userEmail && l.userEmail.toLowerCase().includes(q));
    const matchLevel = logFilter === 'ALL' || l.level === logFilter;
    return matchQuery && matchLevel;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>SYSTEM AUDIT LOGS</h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 20,
              background: isStreaming ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: isStreaming ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
              color: isStreaming ? '#15803D' : '#B91C1C',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.04em'
            }}>
              <span style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isStreaming ? '#22C55E' : '#EF4444',
                boxShadow: isStreaming ? '0 0 8px #22C55E' : 'none',
                animation: isStreaming ? 'pulse 1.5s infinite' : 'none'
              }} />
              {isStreaming ? 'STREAMING LIVE' : 'STREAM PAUSED'}
            </span>
          </div>
          <p className="text-slate-500 text-sm font-medium mt-1">Realtime event stream, security access logs, database pool events and operational traces.</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => setIsStreaming(!isStreaming)}
            className="btn-action-sm"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              background: isStreaming ? '#FFF1F2' : '#F0FDF4',
              borderColor: isStreaming ? '#FECDD3' : '#BBF7D0',
              color: isStreaming ? '#E11D48' : '#15803D',
              fontWeight: 700
            }}
          >
            {isStreaming ? <Pause size={14} /> : <Play size={14} />} 
            {isStreaming ? 'Pause Stream' : 'Resume Stream'}
          </button>
          
          <button 
            onClick={handleRefresh}
            className="btn-action-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} /> Refresh Logs
          </button>

          <button 
            onClick={handleExportLogs}
            className="btn-action-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: '#1A5276', color: '#1A5276' }}
          >
            <Download size={14} /> Export Logs (JSON)
          </button>

          <button 
            onClick={handleClearLogs}
            className="btn-action-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: '#CBD5E1', color: '#64748B' }}
            title="Reset audit logs"
          >
            <Trash2 size={14} /> Clear Logs
          </button>
        </div>
      </div>

      {/* Main Log Viewer Card */}
      <div className="admin-card-v2 flex flex-col gap-4">
        {/* Controls Deck */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 280, maxWidth: 420 }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search log messages, user email, events..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10,
                border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.85rem', fontWeight: 600
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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

        {/* Terminal Log Console */}
        <div style={{
          background: '#0E2F44', borderRadius: 16, padding: 20,
          fontFamily: "'Courier New', Courier, monospace", fontSize: '0.82rem',
          color: '#E2E8F0', height: 480, overflowY: 'auto', border: '1px solid #1E4E6D',
          position: 'relative'
        }}>
          {/* Terminal Top Bar */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justify: 'space-between',
            paddingBottom: 12, 
            marginBottom: 12, 
            borderBottom: '1px solid rgba(255,255,255,0.1)', 
            color: '#94A3B8', 
            fontSize: '0.75rem', 
            fontWeight: 700 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Terminal size={14} color="#38BDF8" /> 
              <span>SYSTEM TRACE LOG TERMINAL — STREAMING</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.7rem' }}>
              <span style={{ color: isLivePulse ? '#4ADE80' : '#94A3B8', transition: 'color 0.3s ease' }}>
                {isLivePulse ? '⚡ NEW EVENT RECEIVED' : '● REALTIME ACTIVE'}
              </span>
              <span style={{ color: '#64748B' }}>TOTAL: {filteredLogs.length} LOGS</span>
            </div>
          </div>

          {/* Log Stream Container */}
          <div className="flex flex-col gap-2">
            {filteredLogs.length === 0 ? (
              <div style={{ color: '#64748B', padding: 20, textAlign: 'center' }}>
                No log entries matching filter &quot;{logFilter}&quot;.
              </div>
            ) : (
              filteredLogs.map(log => {
                const color = log.level === 'SECURITY' ? '#F43F5E' : log.level === 'WARN' ? '#F59E0B' : log.level === 'ERROR' ? '#EF4444' : '#38BDF8';
                return (
                  <div key={log.id} style={{ display: 'flex', gap: 10, lineHeight: 1.4, wordBreak: 'break-all', alignItems: 'flex-start' }}>
                    <span style={{ color: '#64748B', flexShrink: 0, fontSize: '0.8rem' }}>[{log.timestamp}]</span>
                    <span style={{ color: color, fontWeight: 700, flexShrink: 0, width: 85 }}>[{log.level}]</span>
                    <span style={{ color: '#A5F3FC', flexShrink: 0, width: 80 }}>[{log.category}]</span>
                    <span style={{ color: '#FCD34D', flexShrink: 0, fontWeight: 700, fontSize: '0.78rem' }}>&lt;{log.userEmail || 'system@sgu.edu'}&gt;</span>
                    <span style={{ color: '#F8FAFC' }}>{log.message}</span>
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
