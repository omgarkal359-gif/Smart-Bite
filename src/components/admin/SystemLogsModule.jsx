import { useState, useEffect } from 'react';
import { RefreshCw, Download, Search, Terminal } from 'lucide-react';

export const SystemLogsModule = () => {
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    generateSystemLogs();
  }, []);

  function generateSystemLogs() {
    const now = new Date();
    const seedLogs = [
      { id: 101, level: 'SECURITY', message: 'Super Admin login session initialized from ip 157.32.14.88', timestamp: new Date(now - 1000 * 60 * 2).toLocaleTimeString(), category: 'Auth' },
      { id: 102, level: 'INFO', message: 'Order #1004 created at stall "rohit-vadewale" (₹155 - Online UPI)', timestamp: new Date(now - 1000 * 60 * 5).toLocaleTimeString(), category: 'Orders' },
      { id: 103, level: 'INFO', message: 'Stall "mangales-snacks" updated status to ONLINE (busyMode: false)', timestamp: new Date(now - 1000 * 60 * 12).toLocaleTimeString(), category: 'Vendors' },
      { id: 104, level: 'WARN', message: 'Supabase DB pool connection latency spike detected (42ms)', timestamp: new Date(now - 1000 * 60 * 22).toLocaleTimeString(), category: 'Database' },
      { id: 105, level: 'INFO', message: 'Order #1002 marked COMPLETED by vendor "narayana"', timestamp: new Date(now - 1000 * 60 * 35).toLocaleTimeString(), category: 'Orders' },
      { id: 106, level: 'SECURITY', message: 'Failed login attempt for user "admin_invalid" from ip 103.22.10.4', timestamp: new Date(now - 1000 * 60 * 50).toLocaleTimeString(), category: 'Auth' },
      { id: 107, level: 'INFO', message: 'Socket.io broadcast room "vendor-cool-cravings" client connected', timestamp: new Date(now - 1000 * 60 * 75).toLocaleTimeString(), category: 'Socket' },
    ];
    setLogs(seedLogs);
  }

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
    const matchQuery = !q || l.message.toLowerCase().includes(q) || l.category.toLowerCase().includes(q);
    const matchLevel = logFilter === 'ALL' || l.level === logFilter;
    return matchQuery && matchLevel;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Title */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="heading-2 text-2xl text-slate-900" style={{ margin: 0 }}>SYSTEM AUDIT LOGS</h1>
          <p className="text-slate-500 text-sm font-medium">Realtime event stream, security access logs, database pool events and operational traces.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={generateSystemLogs}
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
        </div>
      </div>

      {/* Main Log Viewer Card */}
      <div className="admin-card-v2 flex flex-col gap-4">
        {/* Controls Deck */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search log messages, IP addresses, events..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '9px 12px 9px 36px', borderRadius: 10,
                border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.85rem', fontWeight: 600
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
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
          color: '#E2E8F0', maxHeight: 480, overflowY: 'auto', border: '1px solid #1E4E6D'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94A3B8', fontSize: '0.75rem', fontWeight: 700 }}>
            <Terminal size={14} /> SYSTEM TRACE LOG TERMINAL — STREAMING
          </div>

          <div className="flex flex-col gap-2">
            {filteredLogs.length === 0 ? (
              <div style={{ color: '#64748B', padding: 20, textAlign: 'center' }}>
                No log entries matching filter &quot;{logFilter}&quot;.
              </div>
            ) : (
              filteredLogs.map(log => {
                const color = log.level === 'SECURITY' ? '#F43F5E' : log.level === 'WARN' ? '#F59E0B' : log.level === 'ERROR' ? '#EF4444' : '#38BDF8';
                return (
                  <div key={log.id} style={{ display: 'flex', gap: 12, lineHeight: 1.4, wordBreak: 'break-all' }}>
                    <span style={{ color: '#64748B', flexShrink: 0 }}>[{log.timestamp}]</span>
                    <span style={{ color: color, fontWeight: 700, flexShrink: 0, width: 80 }}>[{log.level}]</span>
                    <span style={{ color: '#A5F3FC', flexShrink: 0 }}>[{log.category}]</span>
                    <span style={{ color: '#F8FAFC' }}>{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
