import crypto from 'crypto';
import { db } from '../db.js';
import { getPaymentProvider } from '../services/PaymentProviderFactory.js';
import { sendReceiptEmail } from '../utils/email.js';
import { broadcastQueueUpdate } from './orders.controller.js';
import { config } from '../config.js';

/**
 * Endpoint to check the backend-authoritative status of a payment.
 * GET /api/payments/:paymentId/status
 */
export async function getPaymentStatus(req, res, next) {
  const { paymentId } = req.params;
  try {
    const order = await db.get('SELECT * FROM orders WHERE paymentId = ? OR payment_id = ?', [paymentId, paymentId]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Payment/Order not found.' });
    }

    // Owner check: Students and guests can only check status of their own payments
    const reqUserId = (req.user?.id || '').trim().toLowerCase();
    const reqUserRole = (req.user?.role || 'student').trim().toLowerCase();
    const orderOwner = (order.customerId || '').trim().toLowerCase();

    if ((reqUserRole === 'student' || reqUserRole === 'guest') && reqUserId && orderOwner && orderOwner !== reqUserId) {
      return res.status(403).json({ success: false, message: 'Access Denied: You are not authorized to view this payment status.' });
    }

    res.json({
      success: true,
      paymentId: order.paymentId,
      orderId: order.id,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      total: order.total
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Authoritative Webhook callback endpoint for payments.
 * POST /api/payments/webhook/payment
 */
export async function webhookPaymentHandler(req, res, next) {
  try {
    const payload = req.body;
    const headers = req.headers;
    const provider = getPaymentProvider();

    // 1. Verify Webhook signature/authentication is valid (Rule 7)
    const verification = await provider.verifyWebhook(payload, headers);
    if (!verification.success) {
      return res.status(401).json({ success: false, message: `Webhook authentication failed: ${verification.error}` });
    }

    const { paymentId, providerPaymentId, amountPaise, currency, status } = verification;

    // Deduplication key using providerEventId (Correction 4)
    const providerEventId = payload.eventId || payload.providerEventId || headers['x-provider-event-id'] || `EVT-PAY-${paymentId}-${status}`;
    
    // Check if webhook was already processed
    const existingEvent = await db.get('SELECT * FROM payment_events WHERE provider = ? AND provider_event_id = ?', [config.PAYMENT_PROVIDER, providerEventId]);
    if (existingEvent) {
      return res.json({ success: true, message: 'Payment webhook event already processed.' });
    }

    let order = null;
    let orderItems = [];

    // Rule 10: Perform state updates inside a single database transaction
    await db.transaction(async (tx) => {
      // Re-verify duplicate inside transaction block
      const doubleCheckEvent = await tx.get('SELECT * FROM payment_events WHERE provider = ? AND provider_event_id = ?', [config.PAYMENT_PROVIDER, providerEventId]);
      if (doubleCheckEvent) return;

      // Rule 1: Payment belongs to correct order
      order = await tx.get('SELECT * FROM orders WHERE paymentId = ? OR payment_id = ?', [paymentId, paymentId]);
      if (!order) {
        throw { status: 404, message: 'Payment does not belong to any active order.' };
      }

      // Rule 8 & 9: Payment has not already been processed (replay protection)
      if (order.paymentStatus === 'success') {
        return;
      }

      // Rule 2: Payment belongs to the correct user / order owner where applicable
      if (payload.customerId && order.customerId && payload.customerId.trim().toLowerCase() !== order.customerId.trim().toLowerCase()) {
        throw { status: 400, message: 'Payment user owner mismatch.' };
      }

      // Rule 3: Provider payment ID is valid
      if (!providerPaymentId || typeof providerPaymentId !== 'string' || providerPaymentId.trim() === '') {
        throw { status: 400, message: 'Invalid provider payment ID.' };
      }

      // Rule 4: Provider payment status is successful
      if (status !== 'success') {
        const nextStatus = 'cancelled';
        const nextPaymentStatus = status === 'failed' ? 'failed' : 'cancelled';
        
        await tx.run(
          `UPDATE orders SET 
            status = ?, paymentStatus = ?, payment_status = ?, providerPaymentId = ?, provider_payment_id = ?, 
            paymentFailureReason = ?, payment_failure_reason = ?, paymentVerifiedAt = ?, payment_verified_at = ? 
          WHERE id = ?`,
          [nextStatus, nextPaymentStatus, nextPaymentStatus, providerPaymentId, providerPaymentId, status || 'Failed', status || 'Failed', new Date().toISOString(), new Date().toISOString(), order.id]
        );

        // Update matching settlements to failed
        await tx.run('UPDATE order_settlements SET status = ?, updated_at = ? WHERE order_id = ?', ['failed', new Date().toISOString(), order.id]);
        return;
      }

      // Rule 5: Provider-reported amount matches the server-calculated order amount (prevent price manipulation)
      const expectedAmountPaise = Math.round(order.total * 100);
      if (Math.abs(amountPaise - expectedAmountPaise) > 1) { // 1 paise tolerance
        throw { status: 400, message: `Amount mismatch: expected ${expectedAmountPaise} paise, got ${amountPaise} paise.` };
      }

      // Rule 6: Currency matches the expected currency
      if (currency !== 'INR') {
        throw { status: 400, message: `Currency mismatch: expected INR, got ${currency}.` };
      }

      // All validation rules passed. Perform atomic state updates.
      await tx.run(
        `UPDATE orders SET 
          status = ?, paymentStatus = ?, payment_status = ?, providerPaymentId = ?, provider_payment_id = ?, 
          paymentVerifiedAt = ?, payment_verified_at = ? 
        WHERE id = ?`,
        ['placed', 'success', 'success', providerPaymentId, providerPaymentId, new Date().toISOString(), new Date().toISOString(), order.id]
      );

      // Record this webhook event in the database (Correction 4)
      const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
      await tx.run(
        'INSERT INTO payment_events (provider, provider_event_id, event_type, payload_hash, processed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [config.PAYMENT_PROVIDER, providerEventId, 'payment.success', payloadHash, new Date().toISOString(), new Date().toISOString()]
      );

      orderItems = await tx.all('SELECT * FROM order_items WHERE orderId = ?', [order.id]);
    });

    // Retrieve fresh details to determine if we should send notifications
    const freshOrder = await db.get('SELECT * FROM orders WHERE id = ?', [order.id]);
    if (!freshOrder || freshOrder.paymentStatus !== 'success') {
      return res.json({ 
        success: true, 
        paymentStatus: freshOrder ? freshOrder.paymentStatus : 'failed', 
        message: 'Payment update processed (unsuccessful).' 
      });
    }

    // Rule 6: Do not send email, receipt, or Socket.io notifications until the transaction has committed.
    // Wrap notifications in try-catch so notification failures do not fail the webhook request.
    try {
      const isEmail = freshOrder.customerId?.includes('@');
      if (isEmail) {
        sendReceiptEmail(freshOrder.customerId, freshOrder, orderItems).catch(err => {
          console.error('[RECEIPT DISPATCHER ERROR] Automatic receipt email failed:', err);
        });
      }

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
            ...freshOrder,
            items: stallItems.map(si => `${si.quantity}x ${si.name}`).join(', '),
            originalItems: stallItems
          };
          io.to(`vendor-${stallId}`).emit('order_new', stallOrder);
        }

        io.to('student').emit('order_new_student', freshOrder);
        broadcastQueueUpdate(io);
      }
    } catch (notificationErr) {
      console.error('[NOTIFICATION WARNING] Post-commit notifications failed:', notificationErr);
    }

    // Initiate Split Settlements to Shop Accounts Async (Post-Commit) (Correction 2 & 14)
    // Run async transfer calls so gateway latency doesn't block the webhook response
    initiateOrderSettlements(freshOrder.id, provider).catch(err => {
      console.error('[SETTLEMENT DISPATCHER ERROR] Failed to initiate split transfers:', err);
    });

    res.json({ success: true, paymentStatus: 'success', message: 'Order successfully placed.' });
  } catch (err) {
    if (err.status) {
      res.status(err.status).json({ success: false, message: err.message });
    } else {
      next(err);
    }
  }
}

/**
 * Initiates the split settlement transfers for an order.
 * @param {string} orderId 
 * @param {PaymentProviderInterface} provider 
 */
async function initiateOrderSettlements(orderId, provider) {
  const settlements = await db.all('SELECT * FROM order_settlements WHERE order_id = ? AND status = ?', [orderId, 'pending']);
  for (const sett of settlements) {
    try {
      // Move to 'processing' before API call
      await db.run('UPDATE order_settlements SET status = ?, updated_at = ? WHERE id = ?', ['processing', new Date().toISOString(), sett.id]);
      
      const transferRes = await provider.createSettlement({
        orderId,
        stallId: sett.stallId,
        providerAccountId: sett.providerAccountId || sett.provider_account_id,
        amountPaise: sett.shopAmountPaise || sett.shop_amount_paise,
        currency: sett.currency || 'INR'
      });

      if (transferRes.success) {
        await db.run(
          'UPDATE order_settlements SET provider_transfer_id = ?, updated_at = ? WHERE id = ?',
          [transferRes.providerTransferId, new Date().toISOString(), sett.id]
        );

        // Simulated Transfer Callback Webhook for mock environment
        if (config.PAYMENT_PROVIDER === 'mock') {
          setTimeout(async () => {
            try {
              const settlementPayload = {
                eventId: `EVT-SETT-${sett.id}-${Date.now()}`,
                providerTransferId: transferRes.providerTransferId,
                status: 'success',
                stallId: sett.stallId
              };
              const mockHeaders = {
                'x-provider-signature': provider.generateSignature(settlementPayload)
              };
              await processSettlementWebhook(settlementPayload, mockHeaders);
            } catch (whErr) {
              console.error('[MOCK SETTLEMENT CALLBACK ERROR]', whErr);
            }
          }, 200);
        }
      } else {
        await db.run(
          'UPDATE order_settlements SET status = ?, failure_reason = ?, updated_at = ? WHERE id = ?',
          ['failed', transferRes.error || 'Transfer initiation failed', new Date().toISOString(), sett.id]
        );
      }
    } catch (err) {
      console.error(`[SETTLEMENT INITIATION FAIL] Stall: ${sett.stallId}, Error:`, err);
      await db.run(
        'UPDATE order_settlements SET status = ?, failure_reason = ?, updated_at = ? WHERE id = ?',
        ['failed', err.message || 'API connection error', new Date().toISOString(), sett.id]
      );
    }
  }
}

/**
 * Authoritative Webhook handler for Settlements/Transfers.
 * POST /api/payments/webhook/settlement
 */
export async function webhookSettlementHandler(req, res, next) {
  try {
    const payload = req.body;
    const headers = req.headers;
    await processSettlementWebhook(payload, headers);
    res.json({ success: true, message: 'Settlement transfer processed.' });
  } catch (err) {
    if (err.status) {
      res.status(err.status).json({ success: false, message: err.message });
    } else {
      next(err);
    }
  }
}

/**
 * Helper to execute settlement updates transactionally with idempotency checks.
 */
export async function processSettlementWebhook(payload, headers) {
  const provider = getPaymentProvider();
  const verification = await provider.verifyWebhook(payload, headers);
  if (!verification.success) {
    throw { status: 401, message: `Webhook authentication failed: ${verification.error}` };
  }

  const { providerTransferId, status, stallId } = verification;
  if (!providerTransferId) {
    throw { status: 400, message: 'Provider transfer ID is missing from verification payload.' };
  }

  // Find the matching logical settlement record
  const settlement = await db.get('SELECT * FROM order_settlements WHERE provider_transfer_id = ?', [providerTransferId]);
  if (!settlement) {
    throw { status: 404, message: `Settlement record not found for provider transfer: ${providerTransferId}` };
  }

  const providerEventId = payload.eventId || payload.providerEventId || headers['x-provider-event-id'] || `EVT-SETT-${providerTransferId}-${status}`;

  // Check if webhook event was already processed
  const existingEvent = await db.get('SELECT * FROM payment_events WHERE provider = ? AND provider_event_id = ?', [config.PAYMENT_PROVIDER, providerEventId]);
  if (existingEvent) {
    return;
  }

  await db.transaction(async (tx) => {
    // Double check event inside transaction block
    const doubleCheck = await tx.get('SELECT * FROM payment_events WHERE provider = ? AND provider_event_id = ?', [config.PAYMENT_PROVIDER, providerEventId]);
    if (doubleCheck) return;

    // Log processed event (Correction 4)
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    await tx.run(
      'INSERT INTO payment_events (provider, provider_event_id, event_type, payload_hash, processed_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [config.PAYMENT_PROVIDER, providerEventId, 'settlement.update', payloadHash, new Date().toISOString(), new Date().toISOString()]
    );

    const nextStatus = status === 'success' ? 'completed' : status === 'reversed' ? 'reversed' : 'failed';
    const settledAt = nextStatus === 'completed' ? new Date().toISOString() : null;

    await tx.run(
      'UPDATE order_settlements SET status = ?, settled_at = ?, updated_at = ? WHERE id = ?',
      [nextStatus, settledAt, new Date().toISOString(), settlement.id]
    );
  });
}

/**
 * Backward-compatible generic webhook handler route.
 */
export async function webhookHandler(req, res, next) {
  return webhookPaymentHandler(req, res, next);
}

/**
 * Development & Testing Simulator Endpoint.
 * POST /api/payments/simulate
 */
export async function simulatePayment(req, res, next) {
  // Rule 2: The simulation endpoint must be disabled or rejected in production
  if (process.env.NODE_ENV === 'production' || config.NODE_ENV === 'production') {
    return res.status(403).json({ success: false, message: 'Forbidden: Payment simulation is disabled in production.' });
  }

  const { paymentId, action } = req.body; // action: 'success' | 'failed' | 'cancel'
  try {
    const order = await db.get('SELECT * FROM orders WHERE paymentId = ? OR payment_id = ?', [paymentId, paymentId]);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order/Payment not found.' });
    }

    const provider = getPaymentProvider();
    const providerPaymentId = `SIM-TXN-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const payload = {
      paymentId,
      providerPaymentId,
      amountPaise: Math.round(order.total * 100),
      currency: 'INR',
      status: action === 'success' ? 'success' : action === 'failed' ? 'failed' : 'cancelled',
      customerId: order.customerId,
      eventId: `EVT-SIM-${paymentId}-${Date.now()}`
    };

    const signature = provider.generateSignature(payload);

    // Call webhookPaymentHandler internally to execute the verification end-to-end
    const mockReq = {
      body: payload,
      headers: {
        'x-provider-signature': signature,
        'content-type': 'application/json'
      },
      app: req.app
    };

    let responseCode = 200;
    let responseData = null;

    const mockRes = {
      status(code) {
        responseCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    await webhookPaymentHandler(mockReq, mockRes, next);

    if (responseCode !== 200) {
      return res.status(responseCode).json(responseData);
    }

    res.json(responseData || { success: true, message: 'Simulation executed.' });
  } catch (err) {
    next(err);
  }
}

/**
 * Authoritative Reconciliation Endpoint.
 * POST /api/payments/reconcile
 */
export async function reconcilePaymentsAndSettlements(req, res, next) {
  const token = req.headers['x-reconcile-token'];
  
  // Correction 3: Restrict reconciliation to internal processes using x-reconcile-token
  if (!token || token !== config.RECONCILE_TOKEN) {
    return res.status(403).json({ success: false, message: 'Forbidden: Access denied.' });
  }

  try {
    const provider = getPaymentProvider();
    let reconciledOrdersCount = 0;
    let reconciledSettlementsCount = 0;

    // 1. Reconcile stuck payment_pending orders older than 15 minutes
    const cutoffTime = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const stuckOrders = await db.all(
      "SELECT * FROM orders WHERE status = ? AND timestamp < ?",
      ['payment_pending', cutoffTime]
    );

    for (const order of stuckOrders) {
      try {
        const details = await provider.verifyPayment(order.paymentId);
        if (details.success && details.status === 'success') {
          // Process state updates inside transaction (duplicate check is handled inside)
          const mockReq = {
            body: {
              paymentId: order.paymentId,
              providerPaymentId: details.providerPaymentId || `REC-TXN-${order.id}`,
              amountPaise: details.amountPaise,
              currency: details.currency || 'INR',
              status: 'success',
              eventId: `EVT-REC-PAY-${order.id}-${Date.now()}`
            },
            headers: {
              'x-provider-signature': provider.generateSignature({
                paymentId: order.paymentId,
                providerPaymentId: details.providerPaymentId || `REC-TXN-${order.id}`,
                amountPaise: details.amountPaise,
                currency: details.currency || 'INR',
                status: 'success',
                eventId: `EVT-REC-PAY-${order.id}-${Date.now()}`
              })
            },
            app: req.app
          };

          let responseCode = 200;
          const mockRes = {
            status(code) { responseCode = code; return this; },
            json(data) { return this; }
          };

          await webhookPaymentHandler(mockReq, mockRes, next);
          if (responseCode === 200) {
            reconciledOrdersCount++;
          }
        }
      } catch (err) {
        console.error(`[RECONCILE ORDER FAIL] Order ID ${order.id}:`, err);
      }
    }

    // 2. Reconcile pending or processing settlements older than 2 hours
    const settlementCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const stuckSettlements = await db.all(
      "SELECT * FROM order_settlements WHERE status IN (?, ?) AND created_at < ?",
      ['pending', 'processing', settlementCutoff]
    );

    for (const sett of stuckSettlements) {
      try {
        if (sett.provider_transfer_id) {
          const statusRes = await provider.getSettlementStatus(sett.provider_transfer_id);
          if (statusRes.success) {
            // Process status updates using processSettlementWebhook helper
            const mockPayload = {
              eventId: `EVT-REC-SETT-${sett.id}-${Date.now()}`,
              providerTransferId: sett.provider_transfer_id,
              status: statusRes.status === 'completed' ? 'success' : statusRes.status === 'failed' ? 'failed' : 'processing',
              stallId: sett.stall_id
            };
            const mockHeaders = {
              'x-provider-signature': provider.generateSignature(mockPayload)
            };

            await processSettlementWebhook(mockPayload, mockHeaders);
            reconciledSettlementsCount++;
          }
        }
      } catch (err) {
        console.error(`[RECONCILE SETTLEMENT FAIL] Settlement ID ${sett.id}:`, err);
      }
    }

    res.json({
      success: true,
      reconciledOrdersCount,
      reconciledSettlementsCount
    });
  } catch (err) {
    next(err);
  }
}
