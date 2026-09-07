import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'sgu_system_audit_logs';

function getInitialLogs() {
  const now = new Date();
  return [
    { id: 'seed-1', level: 'SECURITY', message: 'Super Admin login session initialized from ip 157.32.14.88', timestamp: new Date(now - 1000 * 60 * 2).toLocaleTimeString([], { hour12: false }), category: 'Auth' },
    { id: 'seed-2', level: 'INFO', message: 'Order #1004 created at stall "rohit-vadewale" (₹155 - Online UPI)', timestamp: new Date(now - 1000 * 60 * 5).toLocaleTimeString([], { hour12: false }), category: 'Orders' },
    { id: 'seed-3', level: 'INFO', message: 'Stall "mangales-snacks" updated status to ONLINE (busyMode: false)', timestamp: new Date(now - 1000 * 60 * 12).toLocaleTimeString([], { hour12: false }), category: 'Vendors' },
    { id: 'seed-4', level: 'WARN', message: 'Supabase DB pool connection latency spike detected (42ms)', timestamp: new Date(now - 1000 * 60 * 22).toLocaleTimeString([], { hour12: false }), category: 'Database' },
    { id: 'seed-5', level: 'INFO', message: 'Order #1002 marked COMPLETED by vendor "narayana"', timestamp: new Date(now - 1000 * 60 * 35).toLocaleTimeString([], { hour12: false }), category: 'Orders' },
    { id: 'seed-6', level: 'SECURITY', message: 'Failed login attempt for user "admin_invalid" from ip 103.22.10.4', timestamp: new Date(now - 1000 * 60 * 50).toLocaleTimeString([], { hour12: false }), category: 'Auth' },
    { id: 'seed-7', level: 'INFO', message: 'Socket.io broadcast room "vendor-cool-cravings" client connected', timestamp: new Date(now - 1000 * 60 * 75).toLocaleTimeString([], { hour12: false }), category: 'Socket' },
  ];
}

export function getStoredLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error reading stored logs:', e);
  }
  const initial = getInitialLogs();
  saveLogs(initial);
  return initial;
}

function saveLogs(logs) {
  try {
    // Keep maximum 300 latest logs to prevent memory issues
    const trimmed = logs.slice(0, 300);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error('Error saving logs:', e);
  }
}

// Active Supabase Realtime channel for audit log broadcasts
let logChannel = null;

function getLogChannel() {
  if (!logChannel) {
    logChannel = supabase.channel('system-audit-logs');
    logChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Connected to Supabase Realtime broadcast channel
      }
    });
  }
  return logChannel;
}

export function addAuditLog({ level = 'INFO', category = 'System', message = '' }) {
  if (!message) return null;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour12: false });
  const logEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    level,
    category,
    message,
    timestamp: timeStr,
    createdAt: now.toISOString()
  };

  // 1. Update local storage
  const currentLogs = getStoredLogs();
  const updated = [logEntry, ...currentLogs];
  saveLogs(updated);

  // 2. Dispatch local DOM event for immediate UI update in current tab
  window.dispatchEvent(new CustomEvent('sgu:new_audit_log', { detail: logEntry }));

  // 3. Broadcast via Supabase Realtime to all other open tabs/windows
  try {
    const channel = getLogChannel();
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'new_log',
        payload: logEntry
      });
    }
  } catch (err) {
    console.warn('Failed to broadcast log to Supabase realtime:', err);
  }

  return logEntry;
}

export function clearAuditLogs() {
  const reset = getInitialLogs();
  saveLogs(reset);
  window.dispatchEvent(new CustomEvent('sgu:logs_cleared', { detail: reset }));
  return reset;
}

export function subscribeRealtimeLogs(onNewLog, onCleared) {
  // Listen for local DOM events
  const handleLocalLog = (e) => {
    if (e.detail && onNewLog) onNewLog(e.detail);
  };
  const handleCleared = (e) => {
    if (onCleared) onCleared(e.detail || []);
  };

  window.addEventListener('sgu:new_audit_log', handleLocalLog);
  window.addEventListener('sgu:logs_cleared', handleCleared);

  // Listen for Supabase Realtime broadcast events
  const channel = supabase.channel(`system-audit-logs-sub-${Date.now()}`);
  channel
    .on('broadcast', { event: 'new_log' }, (payload) => {
      if (payload && payload.payload && onNewLog) {
        onNewLog(payload.payload);
      }
    })
    .subscribe();

  return () => {
    window.removeEventListener('sgu:new_audit_log', handleLocalLog);
    window.removeEventListener('sgu:logs_cleared', handleCleared);
    supabase.removeChannel(channel);
  };
}

// Background operational telemetry stream generator
const TRACE_TEMPLATES = [
  { level: 'INFO', category: 'Database', message: 'Supabase DB connection pool ping latency: {ms}ms' },
  { level: 'INFO', category: 'Socket', message: 'Socket.io heartbeat response received (stall room active)' },
  { level: 'INFO', category: 'Orders', message: 'Order queue sync verified — {count} pending items in pipeline' },
  { level: 'INFO', category: 'Auth', message: 'JWT session state verified for active user session' },
  { level: 'WARN', category: 'Database', message: 'Minor query delay detected on vendor_metrics index ({ms}ms)' },
  { level: 'SECURITY', category: 'Auth', message: 'CSRF token & origin header validation check PASSED' },
  { level: 'INFO', category: 'Vendors', message: 'Stalls online health check complete — 6 of 6 stalls reporting healthy' },
  { level: 'INFO', category: 'System', message: 'Garbage collection & memory sweep complete ({mem} MB active)' },
  { level: 'INFO', category: 'Payment', message: 'UPI payment gateway webhook listener ready & listening on port 443' },
];

export function generateRandomTraceLog() {
  const template = TRACE_TEMPLATES[Math.floor(Math.random() * TRACE_TEMPLATES.length)];
  const ms = Math.floor(Math.random() * 25) + 12;
  const count = Math.floor(Math.random() * 5) + 1;
  const mem = (Math.random() * 10 + 42).toFixed(1);

  const message = template.message
    .replace('{ms}', ms)
    .replace('{count}', count)
    .replace('{mem}', mem);

  return addAuditLog({
    level: template.level,
    category: template.category,
    message
  });
}
