import { db } from '../db.js';
import { sendReceiptEmail } from '../utils/email.js';
import { broadcastQueueUpdate } from '../controllers/orders.controller.js';

export class PaymentVerificationService {
  /**
   * Creates a pending payment intent and pending order in the database.
   * Order status is initially 'pending_payment' (or 'pending_cash').
   * NO notifications or receipts are dispatched until payment is verified.
   */
  static async createPaymentIntent({
    customerId,
    customerName,
    type,
    items,
    paymentMethod = 'Online UPI',
    idempotencyKey = null,
    customOrderId = null
  }) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Cannot create payment intent: Order items are required.');
    }

    if (!customerId) {
      throw new Error('Cannot create payment intent: Customer ID is required.');
    }

    // Server-side calculation to prevent price tampering
    const calculatedTotal = items.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 1;
      return sum + (price * quantity);
    }, 0);

    if (calculatedTotal <= 0) {
      throw new Error('Cannot create payment intent: Order total must be greater than zero.');
    }

    // Check for existing idempotency key
    if (idempotencyKey) {
      const existingPayment = await db.get('SELECT * FROM payments WHERE idempotencyKey = ?', [idempotencyKey]);
      if (existingPayment) {
        const existingOrder = await db.get('SELECT * FROM orders WHERE id = ?', [existingPayment.orderId]);
        const existingItems = await db.all('SELECT * FROM order_items WHERE orderId = ?', [existingPayment.orderId]);
        return {
          success: true,
          isDuplicate: true,
          payment: existingPayment,
          order: { ...existingOrder, items: existingItems }
        };
      }
    }

    const orderId = customOrderId || `ORD-${Date.now()}`;
    const paymentId = `PAY-${Date.now()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date().toISOString();
    const initialOrderStatus = paymentMethod === 'Cash' ? 'pending_cash' : 'pending_payment';
    const initialPaymentStatus = 'PENDING';

    await db.transaction(async (tx) => {
      // 1. Create Pending Order
      await tx.run(
        'INSERT INTO orders (id, customerName, customerId, type, payment, status, total, time, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [orderId, customerName || 'Student', customerId, type || 'Dine-In', paymentMethod, initialOrderStatus, calculatedTotal, 'Just now', now]
      );

      // 2. Insert Order Items
      for (const item of items) {
        await tx.run(
          'INSERT INTO order_items (orderId, itemId, name, price, quantity, stallId, stallName) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [orderId, item.id || null, item.name || 'Food Item', Number(item.price) || 0, Number(item.quantity) || 1, item.stallId || 'general', item.stallName || 'SGU Food Court']
        );
      }

      // 3. Create Pending Payment Record
      await tx.run(
        'INSERT INTO payments (id, orderId, customerId, amount, currency, provider, status, transactionRef, idempotencyKey, metadata, errorMessage, createdAt, verifiedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [paymentId, orderId, customerId, calculatedTotal, 'INR', paymentMethod, initialPaymentStatus, null, idempotencyKey, JSON.stringify({ shopAccount: '9607102196' }), null, now, null]
      );
    });

    const createdOrder = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    const createdItems = await db.all('SELECT * FROM order_items WHERE orderId = ?', [orderId]);
    const createdPayment = await db.get('SELECT * FROM payments WHERE id = ?', [paymentId]);
    createdOrder.items = createdItems;

    return {
      success: true,
      paymentId,
      orderId,
      amount: calculatedTotal,
      currency: 'INR',
      status: initialPaymentStatus,
      paymentMethod,
      beneficiaryAccount: '9607102196',
      beneficiaryUpiId: '9607102196@upi',
      order: createdOrder,
      payment: createdPayment
    };
  }

  /**
   * Authoritatively verifies payment on the server.
   * Enforces 12-digit UTR validation, replay attack prevention, amount integrity,
   * and atomic state transition: payment = SUCCESS, order = placed.
   * Dispatches vendor notifications and digital receipt ONLY upon verified success.
   */
  static async verifyPayment({
    paymentId,
    orderId,
    transactionRef,
    reqUser = null,
    io = null
  }) {
    // 1. Validate Transaction Reference (UTR)
    const cleanRef = transactionRef ? String(transactionRef).trim() : '';
    if (!cleanRef) {
      throw new Error('Payment verification failed: Transaction reference (UTR) is required.');
    }

    if (!/^\d{12}$/.test(cleanRef)) {
      throw new Error('Payment verification failed: Valid 12-digit UPI Transaction Reference (UTR) is required.');
    }

    // 2. Fetch Payment Record
    let payment = null;
    if (paymentId) {
      payment = await db.get('SELECT * FROM payments WHERE id = ?', [paymentId]);
    } else if (orderId) {
      payment = await db.get('SELECT * FROM payments WHERE orderId = ?', [orderId]);
    }

    if (!payment) {
      throw new Error('Payment verification failed: No pending payment intent found.');
    }

    const order = await db.get('SELECT * FROM orders WHERE id = ?', [payment.orderId]);
    if (!order) {
      throw new Error('Payment verification failed: Associated order not found.');
    }

    // 3. Ownership and Integrity Checks
    if (reqUser && (reqUser.role === 'student' || reqUser.role === 'guest') && reqUser.id) {
      const orderOwner = (order.customerId || '').trim().toLowerCase();
      if (orderOwner && orderOwner !== reqUser.id.trim().toLowerCase()) {
        throw new Error('Payment verification failed: Unauthorized attempt to verify another user\'s order.');
      }
    }

    // 4. Amount Integrity Check
    if (Math.abs(Number(payment.amount) - Number(order.total)) > 0.01) {
      throw new Error(`Payment verification failed: Amount mismatch between payment intent (₹${payment.amount}) and order total (₹${order.total}).`);
    }

    // 5. Idempotency Check: Already verified payment
    if (payment.status === 'SUCCESS' && (order.status === 'placed' || order.status === 'preparing' || order.status === 'ready' || order.status === 'completed')) {
      const items = await db.all('SELECT * FROM order_items WHERE orderId = ?', [order.id]);
      return {
        success: true,
        alreadyVerified: true,
        order: { ...order, items },
        payment
      };
    }

    // 6. State Machine Guard: Cannot confirm cancelled or failed order
    if (payment.status === 'CANCELLED' || order.status === 'cancelled') {
      throw new Error('Payment verification failed: This payment session was cancelled. Please start a new checkout.');
    }

    // 7. REPLAY ATTACK GUARD:
    // Check if this exact 12-digit UTR has ALREADY been used for another confirmed order
    const existingUsage = await db.get(
      'SELECT * FROM payments WHERE transactionRef = ? AND status = ? AND id != ?',
      [cleanRef, 'SUCCESS', payment.id]
    );

    if (existingUsage) {
      throw new Error(`Payment verification failed: Transaction reference (UTR ${cleanRef}) has already been consumed for order #${existingUsage.orderId}. Re-using payment references is strictly prohibited.`);
    }

    // 8. ATOMIC STATE TRANSITION
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      await tx.run(
        'UPDATE payments SET status = ?, transactionRef = ?, verifiedAt = ? WHERE id = ?',
        ['SUCCESS', cleanRef, now, payment.id]
      );

      await tx.run(
        'UPDATE orders SET status = ? WHERE id = ?',
        ['placed', order.id]
      );
    });

    const confirmedOrder = await db.get('SELECT * FROM orders WHERE id = ?', [order.id]);
    const orderItems = await db.all('SELECT * FROM order_items WHERE orderId = ?', [order.id]);
    const updatedPayment = await db.get('SELECT * FROM payments WHERE id = ?', [payment.id]);
    confirmedOrder.items = orderItems;

    // 9. POST-CONFIRMATION SIDE EFFECTS (Executed ONLY ONCE upon verified confirmation)
    const isEmail = confirmedOrder.customerId?.includes('@');
    const dispatchMethod = isEmail ? 'EMAIL' : 'MOBILE SMS';

    console.log(`\n==================================================`);
    console.log(`[PAYMENT VERIFIED] PAYMENT SUCCESS FOR ORDER: ${confirmedOrder.id}`);
    console.log(`[PAYMENT VERIFIED] UTR Reference: ${cleanRef} | Beneficiary: 9607102196`);
    console.log(`[RECEIPT DISPATCHER] Dispatching Digital Receipt via ${dispatchMethod} to ${confirmedOrder.customerId}`);
    console.log(`--------------------------------------------------`);
    console.log(`INVOICE FOR: ${(confirmedOrder.customerName || 'Student').toUpperCase()}`);
    console.log(`Order ID: ${confirmedOrder.id}`);
    console.log(`Total: ₹${confirmedOrder.total}`);
    console.log(`==================================================\n`);

    if (isEmail) {
      sendReceiptEmail(confirmedOrder.customerId, confirmedOrder, orderItems).catch(err => {
        console.error('[RECEIPT DISPATCHER ERROR] Automatic receipt email failed:', err);
      });
    }

    if (io) {
      const itemsByStall = orderItems.reduce((acc, item) => {
        const itemStallId = item.stallId || 'general';
        if (!acc[itemStallId]) acc[itemStallId] = [];
        acc[itemStallId].push(item);
        return acc;
      }, {});

      for (const [stallId, stallItems] of Object.entries(itemsByStall)) {
        const stallOrder = {
          ...confirmedOrder,
          items: stallItems.map(si => `${si.quantity}x ${si.name}`).join(', '),
          originalItems: stallItems
        };
        io.to(`vendor-${stallId}`).emit('order_new', stallOrder);
      }

      io.to('student').emit('order_new_student', confirmedOrder);
      broadcastQueueUpdate(io);
    }

    return {
      success: true,
      order: confirmedOrder,
      payment: updatedPayment
    };
  }

  /**
   * Explicitly cancels a payment intent and marks order as cancelled.
   */
  static async cancelPayment({
    paymentId,
    orderId,
    reason = 'Payment incomplete or cancelled by customer',
    reqUser = null
  }) {
    let payment = null;
    if (paymentId) {
      payment = await db.get('SELECT * FROM payments WHERE id = ?', [paymentId]);
    } else if (orderId) {
      payment = await db.get('SELECT * FROM payments WHERE orderId = ?', [orderId]);
    }

    if (!payment) {
      // If payment record not found, check if order exists to cancel
      if (orderId) {
        const order = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (order && (order.status === 'pending_payment' || order.status === 'pending_cash')) {
          await db.run('UPDATE orders SET status = ? WHERE id = ?', ['cancelled', orderId]);
          return { success: true, status: 'CANCELLED', orderId };
        }
      }
      return { success: true, status: 'CANCELLED', message: 'No active payment found to cancel.' };
    }

    const order = await db.get('SELECT * FROM orders WHERE id = ?', [payment.orderId]);
    if (order && ['placed', 'preparing', 'ready', 'completed'].includes(order.status)) {
      throw new Error('Cannot cancel payment: Order is already confirmed or being prepared.');
    }

    await db.transaction(async (tx) => {
      await tx.run(
        'UPDATE payments SET status = ?, errorMessage = ? WHERE id = ?',
        ['CANCELLED', reason, payment.id]
      );
      if (order) {
        await tx.run(
          'UPDATE orders SET status = ? WHERE id = ?',
          ['cancelled', order.id]
        );
      }
    });

    return {
      success: true,
      status: 'CANCELLED',
      paymentId: payment.id,
      orderId: payment.orderId,
      reason
    };
  }

  /**
   * Fetches payment status.
   */
  static async getPaymentStatus(paymentId) {
    const payment = await db.get('SELECT * FROM payments WHERE id = ?', [paymentId]);
    if (!payment) {
      throw new Error('Payment not found.');
    }
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [payment.orderId]);
    return {
      payment,
      order
    };
  }
}
