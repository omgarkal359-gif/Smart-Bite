import { db } from '../db.js';

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
    if (req.user?.role === 'owner' && req.user?.shopId !== id) {
      return res.status(403).json({ success: false, message: 'Access Denied: You are only authorized to manage your assigned stall.' });
    }

    const current = await db.get('SELECT * FROM stalls WHERE id = ?', [id]);
    if (!current) return res.status(404).json({ message: 'Stall not found' });

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
    if (req.user?.role === 'owner' && req.user?.shopId !== id) {
      return res.status(403).json({ success: false, message: 'Access Denied: You are only authorized to manage menu items for your assigned stall.' });
    }

    const result = await db.run(
      'INSERT INTO menu_items (stallId, name, price, isVeg, category, stock, available) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [id, name, price, isVeg !== undefined ? (isVeg ? 1 : 0) : 1, category || 'Main', stock !== undefined ? stock : 20]
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

