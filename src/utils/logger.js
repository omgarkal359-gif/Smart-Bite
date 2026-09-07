import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'sgu_system_audit_logs';

function getInitialLogs() {
  const now = new Date();
  return [
    { id: 'seed-1', level: 'SECURITY', message: 'Super Admin login session initialized from ip 157.32.14.88', userEmail: 'admin@sgu.edu', timestamp: new Date(now - 1000 * 60 * 2).toLocaleTimeString([], { hour12: false }), category: 'Auth' },
    { id: 'seed-2', level: 'INFO', message: 'Order #1004 created by student (₹155 - Online UPI)', userEmail: 'student@sgu.edu', timestamp: new Date(now - 1000 * 60 * 5).toLocaleTimeString([], { hour12: false }), category: 'Orders' },
    { id: 'seed-3', level: 'INFO', message: 'Stall "mangales-snacks" updated status to ONLINE (busyMode: false)', userEmail: 'vendor.mangales@sguk.ac.in', timestamp: new Date(now - 1000 * 60 * 12).toLocaleTimeString([], { hour12: false }), category: 'Vendors' },
    { id: 'seed-4', level: 'WARN', message: 'Supabase DB pool connection latency spike detected (42ms)', userEmail: 'system@sgu.edu', timestamp: new Date(now - 1000 * 60 * 22).toLocaleTimeString([], { hour12: false }), category: 'Database' },
    { id: 'seed-5', level: 'INFO', message: 'Order #1002 marked COMPLETED by vendor', userEmail: 'vendor.narayana@sguk.ac.in', timestamp: new Date(now - 1000 * 60 * 35).toLocaleTimeString([], { hour12: false }), category: 'Orders' },
    { id: 'seed-6', level: 'SECURITY', message: 'Failed login attempt for user "admin_invalid" from ip 103.22.10.4', userEmail: 'admin_invalid@sgu.edu', timestamp: new Date(now - 1000 * 60 * 50).toLocaleTimeString([], { hour12: false }), category: 'Auth' },
    { id: 'seed-7', level: 'INFO', message: 'Socket.io broadcast room "vendor-cool-cravings" client connected', userEmail: 'vendor.coolcravings@sguk.ac.in', timestamp: new Date(now - 1000 * 60 * 75).toLocaleTimeString([], { hour12: false }), category: 'Socket' },
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

export function addAuditLog({ level = 'INFO', category = 'System', message = '', userEmail = '' }) {
  if (!message) return null;

  let email = userEmail;
  if (!email) {
    try {
      const raw = sessionStorage.getItem('sgu_user') || localStorage.getItem('sgu_user');
      if (raw) {
        const u = JSON.parse(raw);
        email = u?.username || u?.email || u?.id || '';
      }
    } catch (_e) {}
  }
  if (!email) email = 'system@sgu.edu';

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour12: false });
  const logEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    level,
    category,
    message,
    userEmail: email,
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

// Operational telemetry stream generator (RPC / background fake logs removed as requested)
export function generateRandomTraceLog() {
  return null;
}
