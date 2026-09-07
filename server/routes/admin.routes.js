import { Router } from 'express';
import { 
  getMetrics, 
  getVendors, 
  createVendor, 
  updateVendor,
  updateVendorStatus,
  getRoles, 
  updateRolePermissions,
  getAuditLogs,
  getRecoveryStatus,
  triggerRecoverySync,
  getBackups,
  triggerBackup,
  getSystemHealth,
  getUsers,
  createUser,
  updateUserStatus,
  updateUserRole,
  resetUserSession,
  runIntegrityCheckHandler,
  archiveAuditLogsHandler
} from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Strict Admin Authorization Middleware applied to all routes in this router
router.use(requireAuth);
router.use(requireRole('admin'));

// Metrics Overview
router.get('/metrics', getMetrics);

// Vendor Management
router.get('/vendors', getVendors);
router.post('/vendors', createVendor);
router.put('/vendors/:id', updateVendor);
router.patch('/vendors/:id/status', updateVendorStatus);

// Role Access Control (RBAC)
router.get('/roles', getRoles);
router.patch('/roles', updateRolePermissions);

// Security & Audit Logs
router.get('/audit-logs', getAuditLogs);
router.get('/audit-logs/export', getAuditLogs);
router.post('/audit-logs/archive', archiveAuditLogsHandler);

// Database Integrity Verification
router.get('/integrity-check', runIntegrityCheckHandler);

// Data Recovery
router.get('/recovery/status', getRecoveryStatus);
router.post('/recovery/sync', triggerRecoverySync);

// Database Backups
router.get('/backups', getBackups);
router.post('/backups/trigger', triggerBackup);

// System Health
router.get('/system-health', getSystemHealth);

// User Directory
router.get('/users', getUsers);
router.post('/users', createUser);
router.patch('/users/:id/status', updateUserStatus);
router.patch('/users/:id/role', updateUserRole);
router.post('/users/:id/reset-session', resetUserSession);

export default router;
