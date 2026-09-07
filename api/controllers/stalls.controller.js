import { db } from '../db.js';
import { hasStallAccess } from '../middleware/auth.js';

export async function getStalls(req, res, next) {
  try {
    const stalls = await db.all('SELECT * FROM stalls');
    res.json(stalls);
  } catch (err) {
    next(err);
  }
}

export async function updateStallStatus(req, res, next) {
  const { id } = req.params;
  const { online, waitTime, busyMode } = req.body;
  try {
    const current = await db.get('SELECT * FROM stalls WHERE id = ?', [id]);
    if (!current) {
      return res.status(404).json({ success: false, message: 'Stall not found' });
    }

    // Server-side ownership validation:
    // Admin has universal access. Owner can only modify their own stall.
    if (!hasStallAccess(req.user, id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this stall status'
      });
    }

    const newOnline = online !== undefined ? (online ? 1 : 0) : (current.online !== undefined ? current.online : 0);
    const newWaitTime = waitTime !== undefined ? waitTime : (current.waitTime !== undefined ? current.waitTime : 0);
    const newBusy = busyMode !== undefined ? (busyMode ? 1 : 0) : (current.busyMode !== undefined ? current.busyMode : 0);

    await db.run(
      'UPDATE stalls SET online = ?, waitTime = ?, busyMode = ? WHERE id = ?',
      [newOnline, newWaitTime, newBusy, id]
    );

    const updated = await db.get('SELECT * FROM stalls WHERE id = ?', [id]);
    
    const io = req.app.get('io');
    if (io) {
      io.to('student').emit('stall_status_update', updated);
      io.to(`stall-menu-${id}`).emit('stall_status_update', updated);
    }
    
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function getStallMenu(req, res, next) {
  const { id } = req.params;
  try {
    const items = await db.all('SELECT * FROM menu_items WHERE stallId = ? AND available = 1', [id]);
    const formatted = items.map(item => ({
      ...item,
      stallId: item.stallId || item.stallid
    }));
    res.json(formatted);
  } catch (err) {
    next(err);
  }
}

export async function addStallMenuItem(req, res, next) {
  const { id } = req.params;
  const { name, price, isVeg, category, stock, img } = req.body;
  try {
    const stall = await db.get('SELECT * FROM stalls WHERE id = ?', [id]);
    if (!stall) {
      return res.status(404).json({ success: false, message: 'Stall not found' });
    }

    // Server-side ownership validation:
    // Admin has universal access. Owner can only add menu items to their own stall.
    if (!hasStallAccess(req.user, id)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to add menu items to this stall'
      });
    }

    const result = await db.run(
      'INSERT INTO menu_items (stallId, name, price, isVeg, category, stock, available, img) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
      [id, name, price, isVeg !== undefined ? (isVeg ? 1 : 0) : 1, category || 'Main', stock !== undefined ? stock : 20, img || null]
    );
    
    const newItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [result.id]);
    const io = req.app.get('io');
    if (io) {
      io.to(`stall-menu-${id}`).emit('menu_item_update', newItem);
    }
    res.json(newItem);
  } catch (err) {
    next(err);
  }
}
