import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'sgu_system_audit_logs';

export function getStoredLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('Error reading stored logs:', e);
  }
  // No seed data — the audit log starts empty and fills from real events.
  return [];
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
  saveLogs([]);
  window.dispatchEvent(new CustomEvent('sgu:logs_cleared', { detail: [] }));
  return [];
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
