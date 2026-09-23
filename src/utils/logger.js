import { supabase } from '../supabaseClient';

// Audit logging is server-side (Supabase `audit_logs` table). Writes go through
// the SECURITY DEFINER `log_event` RPC (actor stamped from the session); reads
// are admin-only. A same-tab window event gives the admin log view an instant
// optimistic row while the DB round-trips.

function toEntry(r) {
  return {
    id: r.id,
    level: r.level || 'INFO',
    category: r.category || 'System',
    message: r.message || '',
    userEmail: r.actor_email || 'system',
    timestamp: new Date(r.created_at || Date.now()).toLocaleTimeString([], { hour12: false }),
    createdAt: r.created_at || new Date().toISOString(),
    meta: r.meta || {}
  };
}

// Append an audit entry. Fire-and-forget DB write + instant same-tab event.
export function addAuditLog({ level = 'INFO', category = 'System', message = '', userEmail = '' }) {
  if (!message) return null;

  try {
    supabase
      .rpc('log_event', { p_category: category, p_level: level, p_message: message, p_meta: {} })
      .then(() => {}, () => {});
  } catch (_e) {}

  const entry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    level, category, message,
    userEmail: userEmail || '',
    timestamp: new Date().toLocaleTimeString([], { hour12: false }),
    createdAt: new Date().toISOString(),
    meta: {}
  };
  try { window.dispatchEvent(new CustomEvent('sgu:new_audit_log', { detail: entry })); } catch (_e) {}
  return entry;
}

// Fetch recent audit entries from the DB (admin-only via RLS).
export async function fetchAuditLogs(limit = 200) {
  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map(toEntry);
  } catch (_e) {
    return [];
  }
}

// Deprecated sync accessor (audit is now server-side). Kept so older callers
// don't break; the log views should use fetchAuditLogs().
export function getStoredLogs() {
  return [];
}

// Admin: clear the audit trail.
export async function clearAuditLogs() {
  try { await supabase.from('audit_logs').delete().gte('id', 0); } catch (_e) {}
  try { window.dispatchEvent(new CustomEvent('sgu:logs_cleared', { detail: [] })); } catch (_e) {}
  return [];
}

// Subscribe to new audit rows (Supabase Realtime) + same-tab optimistic events.
export function subscribeRealtimeLogs(onNewLog, onCleared) {
  const handleLocalLog = (e) => { if (e.detail && onNewLog) onNewLog(e.detail); };
  const handleCleared = (e) => { if (onCleared) onCleared(e.detail || []); };
  window.addEventListener('sgu:new_audit_log', handleLocalLog);
  window.addEventListener('sgu:logs_cleared', handleCleared);

  const channel = supabase
    .channel(`audit-logs-${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, (payload) => {
      if (payload?.new && onNewLog) onNewLog(toEntry(payload.new));
    })
    .subscribe();

  return () => {
    window.removeEventListener('sgu:new_audit_log', handleLocalLog);
    window.removeEventListener('sgu:logs_cleared', handleCleared);
    supabase.removeChannel(channel);
  };
}

// Deprecated no-op (fake telemetry generator removed).
export function generateRandomTraceLog() {
  return null;
}
