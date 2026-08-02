import { db } from '../db.js';
import { sendReceiptEmail } from '../utils/email.js';

export async function broadcastQueueUpdate(io) {
  if (!io) return;
  try {
    const activeOrders = await db.all(
      `SELECT id, status, customerName FROM orders WHERE status IN ('placed', 'preparing', 'ready') ORDER BY timestamp DESC`
    );
    const formatted = activeOrders.map(o => ({
      id: o.id,
      status: o.status,
      customerName: o.customerName || o.customername
    }));
    io.to('public-board').emit('queue_update', formatted);
  } catch (err) {
    console.error('Error broadcasting queue:', err);
  }
}

export async function createOrder(req, res, next) {
  const { customerName, customerId, type, payment, total, items, id: customId, orderId: reqOrderId } = req.body;
  try {
    const orderId = customId || reqOrderId || `ORD-${Date.now()}`;
    const now = new Date().toISOString();
    const initialStatus = payment === 'Cash' ? 'pending_cash' : 'placed';

    await db.run(
      'INSERT INTO orders (id, customerName, customerId, type, payment, status, total, time, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [orderId, customerName, customerId, type, payment, initialStatus, total, 'Just now', now]
    );

    for (const item of items) {
      await db.run(
        'INSERT INTO order_items (orderId, itemId, name, price, quantity, stallId, stallName) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [orderId, item.id, item.name, item.price, item.quantity, item.stallId, item.stallName]
      );
    }

    const createdOrder = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    const createdItems = await db.all('SELECT * FROM order_items WHERE orderId = ?', [orderId]);
    createdOrder.items = createdItems;

    // --- DIGITAL RECEIPT DISPATCHER ---
    const isEmail = customerId?.includes('@');
    const dispatchMethod = isEmail ? 'EMAIL' : 'MOBILE SMS';
    
    console.log(`\n==================================================`);
    console.log(`[RECEIPT DISPATCHER] NEW ORDER PLACED: ${orderId}`);
    console.log(`[RECEIPT DISPATCHER] Dispatching Digital Receipt to Customer via ${dispatchMethod}:`);
    console.log(`[RECEIPT DISPATCHER] Target: ${customerId}`);
    console.log(`--------------------------------------------------`);
    console.log(`INVOICE FOR ${customerName.toUpperCase()}`);
    console.log(`Order ID: ${orderId}`);
    console.log(`Time: ${now}`);
    console.log(`Payment Method: ${payment}`);
    console.log(`--------------------------------------------------`);
    console.log(`GRAND TOTAL: ₹${total}`);
    console.log(`[RECEIPT DISPATCHER] Dispatch successful! Receipt sent via ${dispatchMethod}.`);
    console.log(`==================================================\n`);

    createdOrder.receiptSentTo = customerId;

    if (isEmail) {
      sendReceiptEmail(customerId, createdOrder, createdItems).catch(err => {
        console.error('[RECEIPT DISPATCHER ERROR] Automatic receipt email failed:', err);
      });
    }

    const io = req.app.get('io');
    if (io) {
      const itemsByStall = createdItems.reduce((acc, item) => {
        const itemStallId = item.stallId || item.stallid;
        if (!acc[itemStallId]) acc[itemStallId] = [];
        acc[itemStallId].push(item);
        return acc;
      }, {});

      for (const [stallId, stallItems] of Object.entries(itemsByStall)) {
        const stallOrder = {
          ...createdOrder,
          customerName: createdOrder.customerName || createdOrder.customername,
          customerId: createdOrder.customerId || createdOrder.customerid,
          items: stallItems.map(si => `${si.quantity}x ${si.name}`).join(', '),
          originalItems: stallItems
        };
        io.to(`vendor-${stallId}`).emit('order_new', stallOrder);
      }

      io.to('student').emit('order_new_student', createdOrder);
      broadcastQueueUpdate(io);
    }

    res.json(createdOrder);
  } catch (err) {
    next(err);
  }
}

export async function resendReceipt(req, res, next) {
  const { id } = req.params;
  const { customEmail } = req.body || {};
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const orderItems = await db.all('SELECT * FROM order_items WHERE orderId = ?', [id]);
    
    const customerIdVal = order.customerId || order.customerid || '';
    const customerNameVal = order.customerName || order.customername || 'Student';
    const paymentVal = order.payment || 'Online UPI';
    const totalVal = order.total || 0;
    const targetRecipient = customEmail || customerIdVal;
    
    const isEmail = targetRecipient.includes('@');
    const dispatchMethod = isEmail ? 'EMAIL' : 'MOBILE SMS';
    const now = new Date().toISOString();
    
    // --- DIGITAL RECEIPT DISPATCHER ---
    const receiptItemsText = orderItems.map(item => {
      const q = item.quantity || 1;
      const n = item.name || '';
      const p = item.price || 0;
      const s = item.stallName || item.stallname || 'Stall';
      return `   - ${q}x ${n} (₹${p} each) - Stall: ${s}`;
    }).join('\n');
    
    console.log(`\n==================================================`);
    console.log(`[RECEIPT DISPATCHER] RESENDING RECEIPT FOR ORDER: ${order.id}`);
    console.log(`[RECEIPT DISPATCHER] Dispatching Digital Receipt to Customer via ${dispatchMethod}:`);
    console.log(`[RECEIPT DISPATCHER] Target: ${targetRecipient}`);
    console.log(`--------------------------------------------------`);
    console.log(`INVOICE FOR ${customerNameVal.toUpperCase()}`);
    console.log(`Order ID: ${order.id}`);
    console.log(`Time: ${now}`);
    console.log(`Payment Method: ${paymentVal}`);
    console.log(`Items:\n${receiptItemsText}`);
    console.log(`--------------------------------------------------`);
    console.log(`GRAND TOTAL: ₹${totalVal}`);
    
    if (isEmail) {
      try {
        const mailResult = await sendReceiptEmail(targetRecipient, order, orderItems);
        if (mailResult.simulated) {
          console.log(`[RECEIPT DISPATCHER] Simulated email dispatch successful.`);
        } else {
          console.log(`[RECEIPT DISPATCHER] Real SMTP email dispatch successful.`);
        }
      } catch (mailErr) {
        console.error(`[RECEIPT DISPATCHER] Nodemailer failed:`, mailErr);
      }
    }
    
    console.log(`[RECEIPT DISPATCHER] Re-dispatch successful! Receipt sent via ${dispatchMethod}.`);
    console.log(`==================================================\n`);

    res.json({ success: true, message: `Receipt successfully resent via ${dispatchMethod}.`, targetRecipient });
  } catch (err) {
    next(err);
  }
}

export async function getActiveQueue(req, res, next) {
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;
  try {
    const activeOrders = await db.all(
      `SELECT id, status, customerName FROM orders WHERE status IN ('placed', 'preparing', 'ready') ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    const formatted = activeOrders.map(o => ({
      id: o.id,
      status: o.status,
      customerName: o.customerName || o.customername
    }));
    res.json(formatted);
  } catch (err) {
    next(err);
  }
}

export async function getStudentOrders(req, res, next) {
  const { customerId } = req.params;
  const reqUserId = (req.headers['x-user-id'] || '').trim().toLowerCase();
  const reqUserRole = (req.headers['x-user-role'] || '').trim().toLowerCase();
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;

  if ((reqUserRole === 'student' || reqUserRole === 'guest') && reqUserId && reqUserId !== customerId.trim().toLowerCase()) {
    console.warn(`[SECURITY GUARD ALERT] Unauthorized student order access attempt! User '${reqUserId}' attempted to access orders of student '${customerId}'`);
    return res.status(403).json({ 
      success: false, 
      message: 'Access Denied: Security Policy Violation. You are only authorized to view your own order history.' 
    });
  }

  try {
    const studentOrders = await db.all(
      'SELECT * FROM orders WHERE LOWER(customerId) = LOWER(?) ORDER BY timestamp DESC LIMIT ? OFFSET ?',
      [customerId.trim(), limit, offset]
    );
    for (const order of studentOrders) {
      order.items = await db.all('SELECT * FROM order_items WHERE orderId = ?', [order.id]);
    }
    res.json(studentOrders);
  } catch (err) {
    next(err);
  }
}

export async function getStallOrders(req, res, next) {
  const { stallId } = req.params;
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;
  try {
    const orderItems = await db.all('SELECT * FROM order_items WHERE stallId = ?', [stallId]);
    const orderIds = [...new Set(orderItems.map(oi => oi.orderId || oi.orderid))];

    if (orderIds.length === 0) return res.json([]);

    // Extract paginated slice of order IDs
    const paginatedIds = orderIds.slice(offset, offset + limit);
    if (paginatedIds.length === 0) return res.json([]);

    const placeholders = paginatedIds.map(() => '?').join(',');
    const orders = await db.all(`SELECT * FROM orders WHERE id IN (${placeholders}) ORDER BY timestamp DESC`, paginatedIds);

    const formattedOrders = orders.map(order => {
      const orderIdVal = order.id;
      const filteredItems = orderItems.filter(oi => (oi.orderId || oi.orderid) === orderIdVal);
      return {
        ...order,
        customerName: order.customerName || order.customername,
        customerId: order.customerId || order.customerid,
        items: filteredItems.map(oi => `${oi.quantity}x ${oi.name}`).join(', '),
        originalItems: filteredItems
      };
    });

    res.json(formattedOrders);
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(req, res, next) {
  const { id } = req.params;
  const reqUserId = (req.headers['x-user-id'] || '').trim().toLowerCase();
  const reqUserRole = (req.headers['x-user-role'] || '').trim().toLowerCase();

  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if ((reqUserRole === 'student' || reqUserRole === 'guest') && reqUserId) {
      const orderOwner = (order.customerId || order.customerid || '').trim().toLowerCase();
      if (orderOwner && orderOwner !== reqUserId) {
        console.warn(`[SECURITY GUARD ALERT] Unauthorized single order view attempt! User '${reqUserId}' attempted to view order #${id} owned by '${orderOwner}'`);
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Security Policy Violation. You cannot access or view another student\'s order invoice.'
        });
      }
    }

    const items = await db.all('SELECT * FROM order_items WHERE orderId = ?', [id]);
    order.items = items;
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req, res, next) {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    const updated = await db.get('SELECT * FROM orders WHERE id = ?', [id]);

    const orderItems = await db.all('SELECT * FROM order_items WHERE orderId = ?', [id]);
    updated.items = orderItems;

    const io = req.app.get('io');
    if (io) {
      const itemsByStall = orderItems.reduce((acc, item) => {
        const itemStallId = item.stallId || item.stallid;
        if (!acc[itemStallId]) acc[itemStallId] = [];
        acc[itemStallId].push(item);
        return acc;
      }, {});

      for (const [stallId, stallItems] of Object.entries(itemsByStall)) {
        const stallOrder = {
          ...updated,
          customerName: updated.customerName || updated.customername,
          customerId: updated.customerId || updated.customerid,
          items: stallItems.map(si => `${si.quantity}x ${si.name}`).join(', '),
          originalItems: stallItems
        };
        io.to(`vendor-${stallId}`).emit('order_status_update', stallOrder);
      }

      io.to(`order-${id}`).emit('order_status_update', updated);
      io.to('student').emit('order_status_update', updated);
      broadcastQueueUpdate(io);
    }

    res.json(updated);
  } catch (err) {
    next(err);
  }
}
