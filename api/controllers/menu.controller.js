import { db } from '../db.js';
import { hasStallAccess } from '../middleware/auth.js';

export async function updateMenuItem(req, res, next) {
  const { itemId } = req.params;
  const { stock, price, available, name, category, img } = req.body;
  try {
    const item = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemId]);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    // Server-side ownership validation:
    // Admin has universal access. Owner can only modify items belonging to their own stall.
    if (!hasStallAccess(req.user, item.stallId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to modify this menu item'
      });
    }

    const newStock = stock !== undefined ? stock : item.stock;
    const newPrice = price !== undefined ? price : item.price;
    const newAvailable = available !== undefined ? (available ? 1 : 0) : item.available;
    const newName = name !== undefined ? name : item.name;
    const newCategory = category !== undefined ? category : item.category;

    await db.run(
      'UPDATE menu_items SET stock = ?, price = ?, available = ?, name = ?, category = ? WHERE id = ?',
      [newStock, newPrice, newAvailable, newName, newCategory, itemId]
    );

    const updated = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemId]);
    const io = req.app.get('io');
    if (io) {
      if (item.stallId) {
        io.to(`stall-menu-${item.stallId}`).emit('menu_item_update', updated);
      }
      io.emit('menu_item_update', updated);
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteMenuItem(req, res, next) {
  const { itemId } = req.params;
  try {
    const item = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemId]);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    // Server-side ownership validation:
    if (!hasStallAccess(req.user, item.stallId)) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to delete this menu item'
      });
    }

    await db.run('DELETE FROM menu_items WHERE id = ?', [itemId]);
    
    const io = req.app.get('io');
    if (io && item.stallId) {
      io.to(`stall-menu-${item.stallId}`).emit('menu_item_delete', { id: itemId, stallId: item.stallId });
    }

    res.json({ success: true, message: 'Menu item deleted' });
  } catch (err) {
    next(err);
  }
}
