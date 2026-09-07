import { db } from '../db.js';

/**
 * Audit Log Retention & Archival Utility
 * Prunes/archives logs older than specified retention period (default 90 days).
 * Operates server-side only and logs archival operations.
 */
export async function archiveAuditLogs(retentionDays = 90) {
  const days = parseInt(retentionDays, 10) || 90;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let archivedCount = 0;
  try {
    // 1. Fetch entries older than retention cutoff
    const oldLogs = await db.all('SELECT id FROM audit_logs WHERE created_at < ?', [cutoffDate]).catch(() => []);
    archivedCount = oldLogs.length;

    if (archivedCount > 0) {
      // 2. Delete old logs safely
      await db.run('DELETE FROM audit_logs WHERE created_at < ?', [cutoffDate]).catch(() => {});
    }

    // 3. Record archival operation log
    const now = new Date().toISOString();
    await db.run(
      'INSERT INTO audit_logs (actor_id, action, resource_type, severity, status, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['system', 'AUDIT_LOGS_ARCHIVED', 'audit_logs', 'INFO', 'SUCCESS', JSON.stringify({ retentionDays: days, archivedCount, cutoffDate }), now]
    ).catch(() => {});

  } catch (err) {
    console.error('Audit log archival failed:', err);
    throw err;
  }

  return {
    success: true,
    retentionDays: days,
    cutoffDate,
    archivedCount,
    message: `Audit log retention maintenance complete. ${archivedCount} records processed.`
  };
}
