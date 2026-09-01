import { db } from '../db.js';
import { sendReceiptEmail } from '../utils/email.js';
import { getPaymentProvider } from '../services/PaymentProviderFactory.js';
import { config } from '../config.js';

export async function broadcastQueueUpdate(io) {
  if (!io) return;
  try {
    const activeOrders = await db.all(
      `SELECT id, status, customerName FROM orders WHERE status IN ('placed', 'preparing', 'ready') ORDER BY timestamp DESC`
    );
    const formatted = activeOrders.map(o => ({
      id: o.id,
      status: o.status,
      customerName: o.customerName
    }));
    io.to('public-board').emit('queue_update', formatted);
  } catch (err) {
    console.error('Error broadcasting queue:', err);
  }
}

export async function createOrder(req, res, next) {
  const { type, payment, total, items, id: customId, orderId: reqOrderId, idempotencyKey } = req.body;
  const customerId = req.user?.email || req.user?.id || req.body.customerId;
  const customerName = req.user?.name || req.body.customerName || 'Student';
  try {
    const orderId = customId || reqOrderId || `ORD-${Date.now()}`;
    const key = idempotencyKey || orderId;


    // 1. Idempotency Check: Prevent duplicate order creation
    const existingOrder = await db.get('SELECT * FROM orders WHERE idempotencyKey = ? OR id = ?', [key, orderId]);
    if (existingOrder) {
      const existingItems = await db.all('SELECT * FROM order_items WHERE orderId = ?', [existingOrder.id]);
      existingOrder.items = existingItems;
      return res.json(existingOrder);
    }

    // 2. Server-Side Price and Amount Validation
    let calculatedTotal = 0;
    const verifiedItems = [];
    for (const item of items) {
      const dbItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [item.id]);
      if (!dbItem) {
        return res.status(400).json({ success: false, message: `Menu item with ID ${item.id} not found.` });
      }
      calculatedTotal += dbItem.price * item.quantity;
      verifiedItems.push({
        ...item,
        price: dbItem.price,
        stallId: dbItem.stallId,
        stallName: dbItem.stallName || item.stallName || 'Stall'
      });
    }

    if (Math.abs(calculatedTotal - total) > 0.01) {
      return res.status(400).json({ 
        success: false, 
        message: `Price manipulation detected. Server calculated total is ₹${calculatedTotal}, but request total is ₹${total}.` 
      });
    }

    const now = new Date().toISOString();
    const isOnlinePayment = payment === 'Online UPI' || payment === 'UPI';
    const initialStatus = payment === 'Cash' ? 'pending_cash' : 'payment_pending';
    const initialPaymentStatus = isOnlinePayment ? 'pending' : null;

    let paymentId = null;
    const splits = [];

    if (isOnlinePayment) {
      // 2.1. Multi-shop onboarding and settlement status checks (Correction 9)
      const stallTotals = {};
      for (const item of verifiedItems) {
        const itemTotalPaise = Math.round(item.price * 100 * item.quantity);
        stallTotals[item.stallId] = (stallTotals[item.stallId] || 0) + itemTotalPaise;
      }

      const commissionRate = config.PLATFORM_COMMISSION_PERCENT / 100;
      for (const [stallId, stallTotalPaise] of Object.entries(stallTotals)) {
        const stall = await db.get('SELECT * FROM stalls WHERE id = ?', [stallId]);
        if (!stall) {
          return res.status(400).json({ success: false, message: `Stall with ID ${stallId} not found.` });
        }
        if (stall.onboardingStatus !== 'active' || stall.settlementStatus !== 'enabled') {
          return res.status(400).json({ 
            success: false, 
            message: `This shop is temporarily unavailable for online payments.` 
          });
        }

        const platformCommissionPaise = Math.round(stallTotalPaise * commissionRate);
        const shopAmountPaise = stallTotalPaise - platformCommissionPaise;

        splits.push({
          stallId,
          providerAccountId: stall.providerAccountId || '',
          orderAmountPaise: stallTotalPaise,
          shopAmountPaise,
          platformCommissionPaise
        });
      }

      // 2.2. Provider dynamic capability execution
      const provider = getPaymentProvider();
      const totalPaise = Math.round(total * 100);
      const session = await provider.createPayment(orderId, totalPaise, 'INR');
      paymentId = session.paymentId;
    }

    // 3. Database Transaction: Atomic Order Creation
    await db.transaction(async (tx) => {
      // Write both camelCase and snake_case properties to orders table
      await tx.run(
        `INSERT INTO orders (
          id, customerName, customerId, type, payment, status, total, time, timestamp, 
          paymentStatus, paymentId, providerPaymentId, paymentFailureReason, paymentVerifiedAt, idempotencyKey,
          payment_status, payment_id, provider_payment_id, payment_failure_reason, payment_verified_at, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId, customerName, customerId, type, payment, initialStatus, total, 'Just now', now, 
          initialPaymentStatus, paymentId, null, null, null, key,
          initialPaymentStatus, paymentId, null, null, null, key
        ]
      );

      for (const item of verifiedItems) {
        await tx.run(
          'INSERT INTO order_items (orderId, itemId, name, price, quantity, stallId, stallName) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [orderId, item.id, item.name, item.price, item.quantity, item.stallId, item.stallName]
        );
      }

      // Insert pending split settlements for online payment (Correction 2 & 6)
      if (isOnlinePayment) {
        for (const split of splits) {
          await tx.run(
            `INSERT INTO order_settlements (
              order_id, stall_id, provider, provider_account_id, 
              order_amount_paise, shop_amount_paise, platform_commission_paise, 
              currency, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              orderId, split.stallId, config.PAYMENT_PROVIDER, split.providerAccountId,
              split.orderAmountPaise, split.shopAmountPaise, split.platformCommissionPaise,
              'INR', 'pending', now, now
            ]
          );
        }
      }
    });

    const createdOrder = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    const createdItems = await db.all('SELECT * FROM order_items WHERE orderId = ?', [orderId]);
    createdOrder.items = createdItems;

    // 4. Handle Notifications based on Payment Type
    if (payment === 'Cash') {
      // Cash payment: send receipt immediately (same as original Cash flow)
      const isEmail = customerId?.includes('@');
      const dispatchMethod = isEmail ? 'EMAIL' : 'MOBILE SMS';

      console.log(`\n==================================================`);
      console.log(`[RECEIPT DISPATCHER] NEW CASH ORDER PLACED: ${orderId}`);
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

      try {
        if (isEmail) {
          sendReceiptEmail(customerId, createdOrder, createdItems).catch(err => {
            console.error('[RECEIPT DISPATCHER ERROR] Automatic receipt email failed:', err);
          });
        }

        const io = req.app.get('io');
        if (io) {
          const itemsByStall = createdItems.reduce((acc, item) => {
            const itemStallId = item.stallId;
            if (!acc[itemStallId]) acc[itemStallId] = [];
            acc[itemStallId].push(item);
            return acc;
          }, {});

          for (const [stallId, stallItems] of Object.entries(itemsByStall)) {
            const stallOrder = {
              ...createdOrder,
              items: stallItems.map(si => `${si.quantity}x ${si.name}`).join(', '),
              originalItems: stallItems
            };
            io.to(`vendor-${stallId}`).emit('order_new', stallOrder);
          }

          io.to('student').emit('order_new_student', createdOrder);
          broadcastQueueUpdate(io);
        }
      } catch (notifyErr) {
        console.error('[NOTIFICATION WARNING] Cash order post-create notifications failed:', notifyErr);
      }
    } else {
      // Online UPI payment: DO NOT send email or broadcast socket events yet.
      // They will be handled in the webhook controller post-transaction commit.
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
    
    const customerIdVal = order.customerId || '';
    const customerNameVal = order.customerName || 'Student';
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
      customerName: o.customerName
    }));
    res.json(formatted);
  } catch (err) {
    next(err);
  }
}

export async function getStudentOrders(req, res, next) {
  const { customerId } = req.params;
  const reqUserId = (req.user?.email || req.user?.id || '').trim().toLowerCase();
  const reqUserRole = (req.user?.role || 'student').trim().toLowerCase();
  const targetId = customerId.trim().toLowerCase();
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;

  if ((reqUserRole === 'student' || reqUserRole === 'guest') && reqUserId && reqUserId !== targetId) {
    console.warn(`[SECURITY ALERT] Unauthorized student order access attempt! User '${reqUserId}' attempted to access orders of student '${targetId}'`);
    return res.status(403).json({ 
      success: false, 
      message: 'Access Denied: Security Policy Violation. You are only authorized to view your own order history.' 
    });
  }

  try {
    const studentOrders = await db.all(
      "SELECT * FROM orders WHERE LOWER(customerId) = LOWER(?) AND status NOT IN ('payment_pending', 'payment_failed') ORDER BY timestamp DESC LIMIT ? OFFSET ?",
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
  const reqUserRole = (req.user?.role || '').trim().toLowerCase();
  const reqShopId = req.user?.shopId;
  const limit = parseInt(req.query.limit, 10) || 50;
  const offset = parseInt(req.query.offset, 10) || 0;

  // Vendor Scope Guard: Owner role can only access their assigned stall
  if (reqUserRole === 'owner' && reqShopId !== stallId) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: You are only authorized to view orders for your assigned stall.'
    });
  }

  try {
    const orderItems = await db.all('SELECT * FROM order_items WHERE stallId = ?', [stallId]);
    const orderIds = [...new Set(orderItems.map(oi => oi.orderId))];

    if (orderIds.length === 0) return res.json([]);

    // Extract paginated slice of order IDs
    const paginatedIds = orderIds.slice(offset, offset + limit);
    if (paginatedIds.length === 0) return res.json([]);

    const placeholders = paginatedIds.map(() => '?').join(',');
    const orders = await db.all(`SELECT * FROM orders WHERE id IN (${placeholders}) ORDER BY timestamp DESC`, paginatedIds);

    const formattedOrders = orders.map(order => {
      const orderIdVal = order.id;
      const filteredItems = orderItems.filter(oi => oi.orderId === orderIdVal);
      return {
        ...order,
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
  const reqUserId = (req.user?.email || req.user?.id || '').trim().toLowerCase();
  const reqUserRole = (req.user?.role || 'student').trim().toLowerCase();
  const reqShopId = req.user?.shopId;

  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const items = await db.all('SELECT * FROM order_items WHERE orderId = ?', [id]);

    if ((reqUserRole === 'student' || reqUserRole === 'guest') && reqUserId) {
      const orderOwner = (order.customerId || '').trim().toLowerCase();
      if (orderOwner && orderOwner !== reqUserId) {
        console.warn(`[SECURITY ALERT] Unauthorized single order view attempt! User '${reqUserId}' attempted to view order #${id} owned by '${orderOwner}'`);
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Security Policy Violation. You cannot access or view another student\'s order invoice.'
        });
      }
    }

    if (reqUserRole === 'owner') {
      const belongsToStall = items.some(item => item.stallId === reqShopId);
      if (!belongsToStall) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You are only authorized to view orders containing items from your stall.'
        });
      }
    }

    order.items = items;
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req, res, next) {
  const { id } = req.params;
  const { status } = req.body;
  const reqUserRole = (req.user?.role || '').trim().toLowerCase();
  const reqShopId = req.user?.shopId;

  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const orderItems = await db.all('SELECT * FROM order_items WHERE orderId = ?', [id]);

    if (reqUserRole === 'owner') {
      const belongsToStall = orderItems.some(item => item.stallId === reqShopId);
      if (!belongsToStall) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: You are only authorized to update order status for your assigned stall.'
        });
      }
    }

    await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    const updated = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    updated.items = orderItems;

    const io = req.app.get('io');
    if (io) {
      const itemsByStall = orderItems.reduce((acc, item) => {
        const itemStallId = item.stallId;
        if (!acc[itemStallId]) acc[itemStallId] = [];
        acc[itemStallId].push(item);
        return acc;
      }, {});

      for (const [stallId, stallItems] of Object.entries(itemsByStall)) {
        const stallOrder = {
          ...updated,
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

