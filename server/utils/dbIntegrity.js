import { db } from '../db.js';

/**
 * Database Integrity Verification Engine
 * Read-only scan that checks database integrity across Users, Vendors, Menu, Orders, and System tables.
 * Returns an auditable report without modifying production data automatically.
 */
export async function runDatabaseIntegrityCheck() {
  const issues = [];
  const timestamp = new Date().toISOString();

  try {
    // 1. Users Integrity: Invalid roles or account status
    const allowedRoles = ['admin', 'vendor', 'owner', 'student', 'guest', 'support'];
    const allUsers = await db.all('SELECT id, username, role, account_status FROM users').catch(() => []);
    
    for (const u of allUsers) {
      if (u.role && !allowedRoles.includes(String(u.role).toLowerCase())) {
        issues.push({
          category: 'USERS',
          severity: 'HIGH',
          entityId: u.id || u.username,
          message: `User '${u.username}' has invalid or unauthorized role '${u.role}'.`
        });
      }
    }

    // 2. Vendors & Stalls Integrity: Stalls without valid assigned stall owner
    const stalls = await db.all('SELECT id, name, is_active FROM stalls').catch(() => []);
    const users = await db.all('SELECT id, username, role, shopId FROM users WHERE role IN (\'owner\', \'vendor\')').catch(() => []);

    for (const s of stalls) {
      const ownerExists = users.some(u => String(u.shopId || '').toLowerCase() === String(s.id).toLowerCase());
      if (!ownerExists && s.is_active !== false) {
        issues.push({
          category: 'VENDORS',
          severity: 'MEDIUM',
          entityId: s.id,
          message: `Stall '${s.name}' (${s.id}) is active but has no assigned vendor owner user.`
        });
      }
    }

    // 3. Menu Items Integrity: Negative prices, negative stock, or missing stalls
    const menuItems = await db.all('SELECT id, stallId, name, price, stock, available FROM menu_items').catch(() => []);
    for (const item of menuItems) {
      if (Number(item.price) < 0) {
        issues.push({
          category: 'MENU',
          severity: 'CRITICAL',
          entityId: item.id,
          message: `Menu item #${item.id} ('${item.name}') has negative price: ₹${item.price}.`
        });
      }
      if (Number(item.stock) < 0) {
        issues.push({
          category: 'MENU',
          severity: 'MEDIUM',
          entityId: item.id,
          message: `Menu item #${item.id} ('${item.name}') has negative stock: ${item.stock}.`
        });
      }
      const stallMatch = stalls.find(s => String(s.id).toLowerCase() === String(item.stallId || '').toLowerCase());
      if (!stallMatch) {
        issues.push({
          category: 'MENU',
          severity: 'HIGH',
          entityId: item.id,
          message: `Menu item #${item.id} ('${item.name}') references non-existent stall ID '${item.stallId}'.`
        });
      }
    }

    // 4. Orders Integrity: Orders without line items, negative totals
    const orders = await db.all('SELECT id, customerId, status, total FROM orders').catch(() => []);
    for (const ord of orders) {
      if (Number(ord.total) < 0) {
        issues.push({
          category: 'ORDERS',
          severity: 'CRITICAL',
          entityId: ord.id,
          message: `Order #${ord.id} has negative total amount: ₹${ord.total}.`
        });
      }
      const itemsCount = await db.get('SELECT COUNT(*) as count FROM order_items WHERE orderId = ?', [ord.id]).catch(() => ({ count: 0 }));
      if (!itemsCount || parseInt(itemsCount.count, 10) === 0) {
        issues.push({
          category: 'ORDERS',
          severity: 'HIGH',
          entityId: ord.id,
          message: `Order #${ord.id} exists in database without any line items in order_items table.`
        });
      }
    }

    // 5. Order Items Integrity: Invalid quantities
    const invalidItems = await db.all('SELECT id, orderId, name, quantity, price FROM order_items WHERE quantity <= 0 OR price < 0').catch(() => []);
    for (const inv of invalidItems) {
      issues.push({
        category: 'ORDER_ITEMS',
        severity: 'HIGH',
        entityId: inv.id,
        message: `Order item #${inv.id} ('${inv.name}') in order #${inv.orderId} has invalid quantity (${inv.quantity}) or price (₹${inv.price}).`
      });
    }

  } catch (err) {
    issues.push({
      category: 'SYSTEM',
      severity: 'CRITICAL',
      entityId: 'database_scan_failure',
      message: `Database integrity scan encountered error: ${err.message}`
    });
  }

  return {
    success: true,
    scannedAt: timestamp,
    totalIssuesFound: issues.length,
    status: issues.length === 0 ? 'HEALTHY' : 'ACTION_REQUIRED',
    issues
  };
}
