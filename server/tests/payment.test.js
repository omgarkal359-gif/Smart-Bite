process.env.NODE_ENV = 'test';
import assert from 'assert';
import http from 'http';
import app from '../server.js';
import { db, initDatabase } from '../db.js';
import { MockPaymentProvider } from '../services/MockPaymentProvider.js';
import { config } from '../config.js';

import jwt from 'jsonwebtoken';

let server;
let PORT;
const testProvider = new MockPaymentProvider();

function getAuthHeader(role = 'admin', userId = 'student@sgu.edu', shopId = 'mangales-snacks') {
  const token = jwt.sign(
    { sub: userId, email: userId, role, shopId },
    config.JWT_SECRET,
    { expiresIn: '1h' }
  );
  return { 'Authorization': `Bearer ${token}` };
}

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;

    let authHeaders = {};
    if (!headers['Authorization'] && !headers['authorization'] && !path.startsWith('/api/payments/webhook')) {
      const role = headers['x-user-role'] || 'admin';
      const userId = headers['x-user-id'] || 'student@sgu.edu';
      const shopId = headers['x-shop-id'] || 'mangales-snacks';
      authHeaders = getAuthHeader(role, userId, shopId);
    }

    const reqHeaders = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers
    };
    if (data) {
      reqHeaders['Content-Length'] = Buffer.byteLength(data);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method,
        headers: reqHeaders
      },
      (res) => {
        let rawData = '';
        res.on('data', chunk => { rawData += chunk; });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(rawData);
          } catch (_e) {
            json = rawData;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        });
      }
    );

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}


async function runPaymentTests() {
  console.log('==================================================');
  console.log(' RUNNING PAYMENT INTEGRATION & ORDER SAFETY TESTS');
  console.log('==================================================\n');

  await initDatabase();

  // Ensure stalls used in tests are present and active
  await db.run(`
    INSERT INTO stalls (id, name, onboarding_status, settlement_status, provider_account_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      onboarding_status=excluded.onboarding_status,
      settlement_status=excluded.settlement_status,
      provider_account_id=excluded.provider_account_id
  `, ['mangales-snacks', 'Southern Delight', 'active', 'enabled', 'acc_MANGALES_SNACKS_123']);

  await db.run(`
    INSERT INTO stalls (id, name, onboarding_status, settlement_status, provider_account_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      onboarding_status=excluded.onboarding_status,
      settlement_status=excluded.settlement_status,
      provider_account_id=excluded.provider_account_id
  `, ['tea-coffee', 'Tea & Coffee', 'active', 'enabled', 'acc_TEA_COFFEE_123']);

  await db.run(`
    INSERT INTO stalls (id, name, onboarding_status, settlement_status, provider_account_id)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      onboarding_status=excluded.onboarding_status,
      settlement_status=excluded.settlement_status,
      provider_account_id=excluded.provider_account_id
  `, ['rohit-vadewale', 'Rohit Vadewale', 'active', 'enabled', 'acc_ROHIT_VADEWALE_123']);

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      PORT = server.address().port;
      resolve();
    });
  });

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    --> ${err.message}`);
      failed++;
    }
  }

  // 1. Successful payment verification and placement flow
  await test('Successful online payment places order', async () => {
    const itemFromMangale = await db.get("SELECT * FROM menu_items WHERE stallId = 'mangales-snacks' LIMIT 1");
    const orderId = `PAYTEST_ORD_${Date.now()}`;
    const idempotencyKey = `PAYTEST_IDEM_${orderId}`;

    const initRes = await request('POST', '/api/orders', {
      id: orderId,
      idempotencyKey,
      customerName: 'Aman Varma',
      customerId: 'aman@sgu.edu',
      items: [
        { id: itemFromMangale.id, name: itemFromMangale.name, price: itemFromMangale.price, quantity: 1, stallId: 'mangales-snacks', stallName: 'Mangale Snacks' }
      ],
      total: itemFromMangale.price,
      payment: 'Online UPI',
      type: 'dine-in'
    }, {
      'x-user-id': 'aman@sgu.edu',
      'x-user-role': 'student'
    });

    assert.strictEqual(initRes.status, 200);
    assert.strictEqual(initRes.body.status, 'payment_pending');
    assert.strictEqual(initRes.body.paymentStatus, 'pending');
    assert.ok(initRes.body.paymentId);

    const paymentId = initRes.body.paymentId;

    const webhookPayload = {
      paymentId,
      providerPaymentId: `TXN-${Date.now()}-SUCCESS`,
      amountPaise: Math.round(itemFromMangale.price * 100),
      currency: 'INR',
      status: 'success',
      customerId: 'aman@sgu.edu',
      eventId: `EVT-SUCCESS-${orderId}`
    };
    const signature = testProvider.generateSignature(webhookPayload);

    const webhookRes = await request('POST', '/api/payments/webhook/payment', webhookPayload, {
      'x-provider-signature': signature
    });

    assert.strictEqual(webhookRes.status, 200);
    assert.strictEqual(webhookRes.body.paymentStatus, 'success');

    const orderCheck = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    assert.strictEqual(orderCheck.status, 'placed');
    assert.strictEqual(orderCheck.paymentStatus, 'success');
  });

  // 2. Failed payment updates order to cancelled
  await test('Failed online payment cancels order', async () => {
    const itemFromMangale = await db.get("SELECT * FROM menu_items WHERE stallId = 'mangales-snacks' LIMIT 1");
    const orderId = `PAYTEST_ORD_${Date.now()}_FAIL`;
    const initRes = await request('POST', '/api/orders', {
      id: orderId,
      customerName: 'Aman Varma',
      customerId: 'aman@sgu.edu',
      items: [
        { id: itemFromMangale.id, name: itemFromMangale.name, price: itemFromMangale.price, quantity: 1, stallId: 'mangales-snacks' }
      ],
      total: itemFromMangale.price,
      payment: 'Online UPI',
      type: 'dine-in'
    }, {
      'x-user-id': 'aman@sgu.edu',
      'x-user-role': 'student'
    });


    const paymentId = initRes.body.paymentId;

    const webhookPayload = {
      paymentId,
      providerPaymentId: `TXN-${Date.now()}-FAIL`,
      amountPaise: Math.round(itemFromMangale.price * 100),
      currency: 'INR',
      status: 'failed',
      customerId: 'aman@sgu.edu',
      eventId: `EVT-FAIL-${orderId}`
    };
    const signature = testProvider.generateSignature(webhookPayload);

    const webhookRes = await request('POST', '/api/payments/webhook/payment', webhookPayload, {
      'x-provider-signature': signature
    });

    assert.strictEqual(webhookRes.status, 200);
    assert.strictEqual(webhookRes.body.paymentStatus, 'failed');

    const orderCheck = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    assert.strictEqual(orderCheck.status, 'cancelled');
    assert.strictEqual(orderCheck.paymentStatus, 'failed');
  });

  // 3. Signature validation failure rejects request
  await test('Invalid webhook signature is rejected with 401', async () => {
    const webhookPayload = {
      paymentId: 'PAY-ANYTHING',
      providerPaymentId: 'TXN-12345',
      amountPaise: 5000,
      currency: 'INR',
      status: 'success'
    };

    const webhookRes = await request('POST', '/api/payments/webhook/payment', webhookPayload, {
      'x-provider-signature': 'invalid-signature-hash-string'
    });

    assert.strictEqual(webhookRes.status, 401);
  });

  // 4. Price manipulation protection rejects request
  await test('Price manipulation returns 400 Bad Request', async () => {
    const itemFromMangale = await db.get("SELECT * FROM menu_items WHERE stallId = 'mangales-snacks' LIMIT 1");
    const orderId = `PAYTEST_ORD_TAMPER_${Date.now()}`;
    const initRes = await request('POST', '/api/orders', {
      id: orderId,
      customerName: 'Aman Varma',
      customerId: 'aman@sgu.edu',
      items: [
        { id: itemFromMangale.id, name: itemFromMangale.name, price: itemFromMangale.price - 5, quantity: 1, stallId: 'mangales-snacks' }
      ],
      total: itemFromMangale.price - 5,
      payment: 'Online UPI',
      type: 'dine-in'
    });

    assert.strictEqual(initRes.status, 400);
    assert.ok(initRes.body.message.includes('Price manipulation'));
  });

  // 5. Onboarding validation check
  await test('Checkout blocks orders from inactive/un-onboarded shops', async () => {
    const itemFromTeaCoffee = await db.get("SELECT * FROM menu_items WHERE stallId = 'tea-coffee' LIMIT 1");
    // Set a shop to inactive (Correction 9)
    await db.run("UPDATE stalls SET onboarding_status = ? WHERE id = ?", ['inactive', 'tea-coffee']);

    const orderId = `PAYTEST_ORD_ONB_${Date.now()}`;
    const res = await request('POST', '/api/orders', {
      id: orderId,
      customerName: 'Aman Varma',
      customerId: 'aman@sgu.edu',
      items: [
        { id: itemFromTeaCoffee.id, name: itemFromTeaCoffee.name, price: itemFromTeaCoffee.price, quantity: 1, stallId: 'tea-coffee' }
      ],
      total: itemFromTeaCoffee.price,
      payment: 'Online UPI',
      type: 'dine-in'
    });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.message.includes('temporarily unavailable'));

    // Re-enable it
    await db.run("UPDATE stalls SET onboarding_status = ? WHERE id = ?", ['active', 'tea-coffee']);
  });

  // 6. paise arithmetic and splitting on 1-shop order
  await test('Paise arithmetic splits correctly for 1-shop order', async () => {
    const itemFromMangale = await db.get("SELECT * FROM menu_items WHERE stallId = 'mangales-snacks' LIMIT 1");
    // Set price to exactly 50 for predictable paise math
    await db.run("UPDATE menu_items SET price = 50.00 WHERE id = ?", [itemFromMangale.id]);

    const orderId = `PAYTEST_ORD_1SH_${Date.now()}`;
    const res = await request('POST', '/api/orders', {
      id: orderId,
      customerName: 'Aman Varma',
      customerId: 'aman@sgu.edu',
      items: [
        { id: itemFromMangale.id, name: itemFromMangale.name, price: 50.00, quantity: 1, stallId: 'mangales-snacks' }
      ],
      total: 50.00,
      payment: 'Online UPI',
      type: 'dine-in'
    });

    assert.strictEqual(res.status, 200);

    const settlement = await db.get('SELECT * FROM order_settlements WHERE order_id = ?', [orderId]);
    assert.ok(settlement);
    assert.strictEqual(settlement.orderAmountPaise, 5000);
    assert.strictEqual(settlement.platformCommissionPaise, 500); // 10% of 50.00
    assert.strictEqual(settlement.shopAmountPaise, 4500);
    assert.strictEqual(settlement.shopAmountPaise + settlement.platformCommissionPaise, settlement.orderAmountPaise);
  });

  // 7. Paise splitting on 2-shop order with rounding verification (e.g. 100.50 total)
  await test('Paise splits and rounding math balances correctly for 2-shop order', async () => {
    const itemFromMangale = await db.get("SELECT * FROM menu_items WHERE stallId = 'mangales-snacks' LIMIT 1");
    const itemFromTeaCoffee = await db.get("SELECT * FROM menu_items WHERE stallId = 'tea-coffee' LIMIT 1");
    // Set prices to exactly 50.50 and 50.00 (Correction 5 & 6)
    await db.run("UPDATE menu_items SET price = 50.50 WHERE id = ?", [itemFromMangale.id]);
    await db.run("UPDATE menu_items SET price = 50.00 WHERE id = ?", [itemFromTeaCoffee.id]);

    const orderId = `PAYTEST_ORD_2SH_${Date.now()}`;
    const res = await request('POST', '/api/orders', {
      id: orderId,
      customerName: 'Aman Varma',
      customerId: 'aman@sgu.edu',
      items: [
        { id: itemFromMangale.id, name: 'Thalipeeth Tamper', price: 50.50, quantity: 1, stallId: 'mangales-snacks' },
        { id: itemFromTeaCoffee.id, name: 'Hot Tea', price: 50.00, quantity: 1, stallId: 'tea-coffee' }
      ],
      total: 100.50,
      payment: 'Online UPI',
      type: 'dine-in'
    });

    assert.strictEqual(res.status, 200);

    const settlements = await db.all('SELECT * FROM order_settlements WHERE order_id = ?', [orderId]);
    assert.strictEqual(settlements.length, 2);

    const s1 = settlements.find(s => s.stallId === 'mangales-snacks');
    const s2 = settlements.find(s => s.stallId === 'tea-coffee');

    assert.strictEqual(s1.orderAmountPaise, 5050);
    assert.strictEqual(s1.platformCommissionPaise, 505); // 10% of 5050
    assert.strictEqual(s1.shopAmountPaise, 4545);
    assert.strictEqual(s1.shopAmountPaise + s1.platformCommissionPaise, s1.orderAmountPaise);

    assert.strictEqual(s2.orderAmountPaise, 5000);
    assert.strictEqual(s2.platformCommissionPaise, 500); // 10% of 5000
    assert.strictEqual(s2.shopAmountPaise, 4500);
    assert.strictEqual(s2.shopAmountPaise + s2.platformCommissionPaise, s2.orderAmountPaise);
  });

  // 8. duplicate webhook handling using payment_events
  await test('Duplicate payment and settlement webhooks are processed idempotently', async () => {
    const itemFromMangale = await db.get("SELECT * FROM menu_items WHERE stallId = 'mangales-snacks' LIMIT 1");
    const orderId = `PAYTEST_ORD_DUP_${Date.now()}`;
    const initRes = await request('POST', '/api/orders', {
      id: orderId,
      customerName: 'Aman Varma',
      customerId: 'aman@sgu.edu',
      items: [
        { id: itemFromMangale.id, name: itemFromMangale.name, price: itemFromMangale.price, quantity: 1, stallId: 'mangales-snacks' }
      ],
      total: itemFromMangale.price,
      payment: 'Online UPI',
      type: 'dine-in'
    }, {
      'x-user-id': 'aman@sgu.edu',
      'x-user-role': 'student'
    });


    assert.strictEqual(initRes.status, 200);
    const paymentId = initRes.body.paymentId;
    const eventId = `EVT-TEST-DUP-${Date.now()}`;

    const webhookPayload = {
      paymentId,
      providerPaymentId: `TXN-${Date.now()}-DUP`,
      amountPaise: Math.round(itemFromMangale.price * 100),
      currency: 'INR',
      status: 'success',
      customerId: 'aman@sgu.edu',
      eventId
    };
    const signature = testProvider.generateSignature(webhookPayload);

    // Call 1
    const res1 = await request('POST', '/api/payments/webhook/payment', webhookPayload, {
      'x-provider-signature': signature
    });
    assert.strictEqual(res1.status, 200);

    // Call 2 (Duplicate)
    const res2 = await request('POST', '/api/payments/webhook/payment', webhookPayload, {
      'x-provider-signature': signature
    });
    assert.strictEqual(res2.status, 200);

    // Verify exactly one payment_events row is present (Correction 4)
    const events = await db.all('SELECT * FROM payment_events WHERE provider_event_id = ?', [eventId]);
    assert.strictEqual(events.length, 1);
  });

  // 9. Secured reconciliation worker checks
  await test('Reconciliation blocks unauthorized requests', async () => {
    const res = await request('POST', '/api/payments/reconcile', {}, {
      'x-reconcile-token': 'wrong-token-value'
    });
    assert.strictEqual(res.status, 403);
  });

  await test('Reconciliation allows authorized requests', async () => {
    const res = await request('POST', '/api/payments/reconcile', {}, {
      'x-reconcile-token': config.RECONCILE_TOKEN
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  // 10. ON DELETE RESTRICT on stalls with settlement history
  await test('Stall deletion is blocked if historical settlements exist', async () => {
    const itemFromMangale = await db.get("SELECT * FROM menu_items WHERE stallId = 'mangales-snacks' LIMIT 1");
    const orderId = `PAYTEST_ORD_DEL_${Date.now()}`;
    await request('POST', '/api/orders', {
      id: orderId,
      customerName: 'Aman Varma',
      customerId: 'aman@sgu.edu',
      items: [
        { id: itemFromMangale.id, name: itemFromMangale.name, price: itemFromMangale.price, quantity: 1, stallId: 'mangales-snacks' }
      ],
      total: itemFromMangale.price,
      payment: 'Online UPI',
      type: 'dine-in'
    });

    // Try deleting the stall (Correction 1)
    try {
      await db.run("DELETE FROM stalls WHERE id = 'mangales-snacks'");
      assert.fail("Should have thrown a RESTRICT foreign key constraint violation error.");
    } catch (err) {
      assert.ok(
        err.message.includes('constraint failed') || 
        err.message.includes('FOREIGN KEY constraint failed') ||
        err.message.includes('RESTRICT')
      );
    }
  });

  server.close();

  console.log('\n==================================================');
  console.log(` PAYMENT TESTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('==================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runPaymentTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
