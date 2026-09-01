import process from 'process';
process.env.NODE_ENV = 'test';
import assert from 'assert';
import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../server.js';
import { db, initDatabase } from '../db.js';
import { config } from '../config.js';

let server;
let PORT;

function getAuthHeader(role = 'admin', userId = 'admin@sgu.edu', shopId = 'mangales-snacks') {
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
    
    // Automatically inject Bearer token if not provided and not a public route
    let authHeaders = {};
    if (!headers['Authorization'] && !headers['authorization']) {
      const role = headers['x-user-role'] || 'admin';
      const userId = headers['x-user-id'] || 'admin@sgu.edu';
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


async function runControllerTests() {
  console.log('==================================================');
  console.log(' RUNNING CONTROLLER UNIT & SECURITY TESTS');
  console.log('==================================================\n');

  await initDatabase();

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

  // 1. System Health Check Endpoint
  await test('GET /api/health returns 200 with status UP', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'UP');
    assert.ok(res.body.version);
  });

  // 2. Dev Email Preview Endpoint
  await test('GET /api/dev/email-preview/:template renders preview or error', async () => {
    const resSuccess = await request('GET', '/api/dev/email-preview/welcome');
    assert.strictEqual(resSuccess.status, 200);

    const resErr = await request('GET', '/api/dev/email-preview/non_existent_template_123');
    assert.strictEqual(resErr.status, 500);
  });

  // 3. Stalls Controller Endpoints
  await test('GET /api/stalls returns list of campus stalls', async () => {
    const res = await request('GET', '/api/stalls');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  await test('PUT /api/stalls/:id/status updates online & wait time status', async () => {
    const res = await request('PUT', '/api/stalls/mangales-snacks/status', {
      online: true,
      waitTime: 15,
      busyMode: true
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, 'mangales-snacks');
    assert.strictEqual(res.body.waitTime, 15);
  });

  // 4. Menu Items Controller Endpoints
  await test('GET /api/stalls/:id/menu returns menu items', async () => {
    const res = await request('GET', '/api/stalls/mangales-snacks/menu');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  await test('POST /api/stalls/:id/menu adds new item to stall', async () => {
    const res = await request('POST', '/api/stalls/mangales-snacks/menu', {
      name: 'UnitTest Special Wrap',
      price: 99,
      isVeg: true,
      category: 'Veg Wraps',
      stock: 25
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.name, 'UnitTest Special Wrap');
    assert.ok(res.body.id);
  });

  await test('PUT /api/menu/:itemId updates stock & availability', async () => {
    const res = await request('PUT', '/api/menu/1', {
      stock: 50,
      price: 50,
      available: true
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, 1);
  });

  // 5. Orders & Security Access Guard Endpoints
  let createdOrderId = `TEST_ORDER_${Date.now()}`;
  await test('POST /api/orders creates new order & dispatches receipt', async () => {
    const res = await request('POST', '/api/orders', {
      id: createdOrderId,
      customerName: 'Test Student',
      customerId: 'student@sgu.edu',
      items: [
        { id: 1, name: 'Dahi Thalipeeth', price: 50, quantity: 1, stallId: 'mangales-snacks', stallName: 'Mangale Snacks' }
      ],
      total: 50,
      payment: 'Cash',
      type: 'dine-in'
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, createdOrderId);
    assert.strictEqual(res.body.total, 50);
  });

  await test('GET /api/orders/queue returns active orders queue', async () => {
    const res = await request('GET', '/api/orders/queue');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  await test('GET /api/orders/student/:customerId fetches student history', async () => {
    const res = await request('GET', '/api/orders/student/student@sgu.edu', null, {
      'x-user-id': 'student@sgu.edu',
      'x-user-role': 'student'
    });
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  await test('GET /api/orders/student/:customerId security guard blocks unauthorized student (403)', async () => {
    const res = await request('GET', '/api/orders/student/victim_student@sgu.edu', null, {
      'x-user-id': 'hacker@sgu.edu',
      'x-user-role': 'student'
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  await test('GET /api/orders/stall/:stallId fetches stall orders for vendor', async () => {
    const res = await request('GET', '/api/orders/stall/mangales-snacks');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });

  await test('GET /api/orders/:id security guard allows order owner', async () => {
    const res = await request('GET', `/api/orders/${createdOrderId}`, null, {
      'x-user-id': 'admin@sgu.edu',
      'x-user-role': 'admin'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, createdOrderId);
  });


  await test('GET /api/orders/:id security guard blocks unauthorized student (403)', async () => {
    const res = await request('GET', `/api/orders/${createdOrderId}`, null, {
      'x-user-id': 'unauthorized@sgu.edu',
      'x-user-role': 'student'
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  await test('POST /api/orders/:id/resend resends digital receipt', async () => {
    const res = await request('POST', `/api/orders/${createdOrderId}/resend`, {
      customEmail: 'student@sgu.edu'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  await test('PUT /api/orders/:id/status updates order status', async () => {
    const res = await request('PUT', `/api/orders/${createdOrderId}/status`, {
      status: 'ready'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ready');
  });

  // 6. Admin Analytics Endpoint
  await test('GET /api/admin/metrics returns sales & stall analytics', async () => {
    const res = await request('GET', '/api/admin/metrics');
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.totalOrders !== undefined);
  });

  server.close();

  console.log('\n==================================================');
  console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('==================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runControllerTests().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
