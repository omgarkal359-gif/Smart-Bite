import { db } from '../db.js';

export async function getMetrics(req, res, next) {
  try {
    const totalOrders = await db.get('SELECT COUNT(*) as count FROM orders');
    const totalSales = await db.get('SELECT SUM(total) as sum FROM orders');
    const activeStalls = await db.get("SELECT COUNT(*) as count FROM stalls WHERE online = 1");
    const allOrdersList = await db.all("SELECT * FROM orders ORDER BY timestamp DESC LIMIT 50");

    for (const order of allOrdersList) {
      order.items = await db.all('SELECT * FROM order_items WHERE orderId = ?', [order.id]);
    }

    res.json({
      totalOrders: totalOrders.count,
      totalSales: totalSales.sum || 0,
      activeStalls: activeStalls.count,
      averageWaitTime: 12, // mock metric, or calculate if wanted
      orders: allOrdersList
    });
  } catch (err) {
    next(err);
  }
}

export async function getUsers(req, res, next) {
  try {
    const users = await db.all('SELECT id, username, name, role, shopId FROM users');
    res.json(users);
  } catch (err) {
    next(err);
  }
}
