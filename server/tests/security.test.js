import assert from 'assert';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import { config } from '../config.js';
import { initDatabase } from '../db.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
    }
  };
}

async function runSecurityTests() {
  console.log('--- STARTING SECURITY & AUTHORIZATION TEST SUITE ---');
  await initDatabase();

  // Test 1: Student login with empty password should return 400 Bad Request
  {
    console.log('[SECURITY TEST 1] Verifying student login requires password...');
    const req = {
      body: { username: 'student@sgu.edu', password: '', role: 'student' }
    };
    const res = createMockRes();
    const next = (err) => { throw err; };

    const { login } = await import('../controllers/auth.controller.js');
    await login(req, res, next);

    assert.strictEqual(res.statusCode, 400, 'Student login without password must return 400');
    assert.strictEqual(res.body.success, false);
    console.log('  -> PASSED: Student login rejected missing password.');
  }

  // Test 2: Vendor stall isolation check
  {
    console.log('[SECURITY TEST 2] Verifying vendor stall boundary isolation...');
    const narayanaOwnerUser = {
      id: 'narayana',
      email: 'narayana',
      role: 'owner',
      shopId: 'narayana'
    };

    // Attempting to update status of a DIFFERENT stall ('tea-coffee')
    const req = {
      params: { id: 'tea-coffee' },
      body: { online: 1, waitTime: 10 },
      user: narayanaOwnerUser,
      app: { get: () => null }
    };
    const res = createMockRes();
    const next = (err) => { throw err; };

    const { updateStallStatus } = await import('../controllers/stalls.controller.js');
    await updateStallStatus(req, res, next);

    assert.strictEqual(res.statusCode, 403, 'Cross-vendor stall status update must return 403 Forbidden');
    assert.strictEqual(res.body.success, false);
    console.log('  -> PASSED: Cross-vendor stall update blocked with 403 Forbidden.');
  }

  // Test 3: Vendor order viewing isolation check
  {
    console.log('[SECURITY TEST 3] Verifying vendor cannot view orders of another stall...');
    const narayanaOwnerUser = {
      id: 'narayana',
      email: 'narayana',
      role: 'owner',
      shopId: 'narayana'
    };

    const req = {
      params: { stallId: 'tea-coffee' },
      query: {},
      user: narayanaOwnerUser
    };
    const res = createMockRes();
    const next = (err) => { throw err; };

    const { getStallOrders } = await import('../controllers/orders.controller.js');
    await getStallOrders(req, res, next);

    assert.strictEqual(res.statusCode, 403, 'Cross-vendor stall order viewing must return 403 Forbidden');
    assert.strictEqual(res.body.success, false);
    console.log('  -> PASSED: Cross-vendor order viewing blocked with 403 Forbidden.');
  }

  // Test 4: Dev email preview route requires admin authentication
  {
    console.log('[SECURITY TEST 4] Verifying dev email preview requires admin role...');
    const studentUser = {
      id: 'student1',
      email: 'student@sgu.edu',
      role: 'student',
      shopId: null
    };

    const { requireRole } = await import('../middleware/auth.js');
    const adminMiddleware = requireRole('admin');

    const req = { user: studentUser };
    const res = createMockRes();
    let calledNext = false;
    const next = () => { calledNext = true; };

    adminMiddleware(req, res, next);

    assert.strictEqual(res.statusCode, 403, 'Non-admin access to admin route must return 403 Forbidden');
    assert.strictEqual(calledNext, false);
    console.log('  -> PASSED: Non-admin access to dev preview blocked with 403 Forbidden.');
  }

  // Test 5: Multi-stall order isolation — a vendor sees ONLY their own line items
  {
    console.log('[SECURITY TEST 5] Verifying vendor sees only own items on a shared multi-stall order...');
    const { db } = await import('../db.js');
    const orderId = `ORD-ISO-${Date.now()}`;

    await db.run(
      `INSERT INTO orders (id, customerName, customerId, type, payment, status, total, time, timestamp,
        paymentStatus, paymentId, providerPaymentId, paymentFailureReason, paymentVerifiedAt, idempotencyKey)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, 'Rahul', 'rahul@sgu.edu', 'Pickup', 'Cash', 'placed', 200, 'now', new Date().toISOString(),
        null, null, null, null, null, orderId]
    );
    await db.run('INSERT INTO order_items (orderId, itemId, name, price, quantity, stallId, stallName) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orderId, 1, 'Wada Pav', 40, 1, 'narayana', 'Narayana']);
    await db.run('INSERT INTO order_items (orderId, itemId, name, price, quantity, stallId, stallName) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orderId, 2, 'Masala Tea', 20, 1, 'tea-coffee', 'Tea & Coffee']);

    const req = {
      params: { id: orderId },
      user: { id: 'narayana', email: 'narayana', role: 'owner', shopId: 'narayana' }
    };
    const res = createMockRes();
    const { getOrderById } = await import('../controllers/orders.controller.js');
    await getOrderById(req, res, (err) => { throw err; });

    assert.strictEqual(res.statusCode, 200, 'Vendor on a shared order must get 200');
    const returnedItems = res.body.items || [];
    assert.ok(returnedItems.length > 0, 'Vendor must see their own items');
    assert.ok(returnedItems.every(i => (i.stallId || i.stallid) === 'narayana'),
      'Vendor response must contain ONLY their own stall items');
    assert.ok(!returnedItems.some(i => (i.stallId || i.stallid) === 'tea-coffee'),
      'Vendor must NOT see another stall\'s items on a shared order');
    console.log('  -> PASSED: Vendor isolated to own line items on shared multi-stall order.');
  }

  console.log('\n--- ALL SECURITY TESTS PASSED SUCCESSFULLY! ---\n');
}

runSecurityTests().catch((err) => {
  console.error('[SECURITY TEST SUITE FAILED]', err);
  process.exit(1);
});
