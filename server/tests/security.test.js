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

  console.log('\n--- ALL SECURITY TESTS PASSED SUCCESSFULLY! ---\n');
}

runSecurityTests().catch((err) => {
  console.error('[SECURITY TEST SUITE FAILED]', err);
  process.exit(1);
});
