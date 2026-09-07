process.env.NODE_ENV = 'test';
import assert from 'assert';
import http from 'http';
import app from '../server.js';
import { db, initDatabase } from '../db.js';

let server;
let PORT;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
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
      price: 55,
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
      payment: 'UPI',
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
      'x-user-id': 'student@sgu.edu',
      'x-user-role': 'student'
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

  // 7. BOLA / IDOR Authorization Security Matrix Tests
  console.log('\n--------------------------------------------------');
  console.log(' BOLA / IDOR AUTHORIZATION MATRIX TESTS');
  console.log('--------------------------------------------------');

  const jwtModule = (await import('jsonwebtoken')).default;
  const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_local_dev_only_998877';

  const ownerAToken = jwtModule.sign(
    { id: 101, email: 'mangales@sgu.edu', role: 'owner', shopId: 'mangales-snacks' },
    JWT_SECRET
  );
  const ownerBToken = jwtModule.sign(
    { id: 102, email: 'noodles@sgu.edu', role: 'owner', shopId: 'oodles-of-noodles' },
    JWT_SECRET
  );
  const adminAuthToken = jwtModule.sign(
    { id: 1, email: 'admin@sgu.edu', role: 'admin', shopId: null },
    JWT_SECRET
  );
  const studentAuthToken = jwtModule.sign(
    { id: 201, email: 'student@sgu.edu', role: 'student', shopId: null },
    JWT_SECRET
  );

  // Identify menu items for Stall A (mangales-snacks) and Stall B (oodles-of-noodles)
  const stallAItems = await db.all('SELECT * FROM menu_items WHERE stallId = ?', ['mangales-snacks']);
  const stallBItems = await db.all('SELECT * FROM menu_items WHERE stallId = ?', ['oodles-of-noodles']);
  assert.ok(stallAItems.length > 0, 'Stall A should have menu items');
  assert.ok(stallBItems.length > 0, 'Stall B should have menu items');

  const itemA = stallAItems[0];
  const itemB = stallBItems[0];

  // TEST 1: Owner A updates an item belonging to Stall A -> SUCCESS (200)
  await test('TEST 1: Owner A updates an item belonging to Stall A -> SUCCESS', async () => {
    const res = await request('PUT', `/api/menu/${itemA.id}`, {
      price: 65,
      stock: 35
    }, {
      'Authorization': `Bearer ${ownerAToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, itemA.id);
    assert.strictEqual(res.body.price, 65);
    assert.strictEqual(res.body.stock, 35);
  });

  // TEST 2: Owner A attempts to update an item belonging to Stall B -> HTTP 403 (DB unchanged)
  await test('TEST 2: Owner A attempts to update an item belonging to Stall B -> HTTP 403 (DB unchanged)', async () => {
    const beforeItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemB.id]);
    const res = await request('PUT', `/api/menu/${itemB.id}`, {
      price: 9999,
      stock: 9999,
      name: 'HACKED NOODLES'
    }, {
      'Authorization': `Bearer ${ownerAToken}`
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);

    // Verify database record was NOT modified
    const afterItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemB.id]);
    assert.strictEqual(afterItem.price, beforeItem.price);
    assert.strictEqual(afterItem.stock, beforeItem.stock);
    assert.strictEqual(afterItem.name, beforeItem.name);
  });

  // TEST 3: Admin updates an item belonging to Stall B -> SUCCESS (200)
  await test('TEST 3: Admin updates an item belonging to Stall B -> SUCCESS', async () => {
    const res = await request('PUT', `/api/menu/${itemB.id}`, {
      price: 75,
      stock: 40
    }, {
      'Authorization': `Bearer ${adminAuthToken}`
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.id, itemB.id);
    assert.strictEqual(res.body.price, 75);
  });

  // TEST 4: Unauthorized role (student) attempts update -> HTTP 403
  await test('TEST 4: Unauthorized role (student) attempts update -> HTTP 403', async () => {
    const res = await request('PUT', `/api/menu/${itemA.id}`, {
      price: 10
    }, {
      'Authorization': `Bearer ${studentAuthToken}`
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  // TEST 5: Invalid / non-existent menu item ID -> HTTP 404
  await test('TEST 5: Invalid/non-existent menu item ID -> HTTP 404', async () => {
    const res = await request('PUT', '/api/menu/99999999', {
      price: 50
    }, {
      'Authorization': `Bearer ${ownerAToken}`
    });
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  // TEST 6: Owner attempts to bypass authorization by sending another stallId/shopId in body -> HTTP 403
  await test('TEST 6: Owner attempts to bypass authorization with forged stallId/shopId in body -> HTTP 403', async () => {
    const beforeItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemB.id]);
    const res = await request('PUT', `/api/menu/${itemB.id}`, {
      stallId: 'mangales-snacks',
      shopId: 'mangales-snacks',
      price: 1337
    }, {
      'Authorization': `Bearer ${ownerAToken}`
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);

    // Verify database record was NOT modified
    const afterItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemB.id]);
    assert.strictEqual(afterItem.price, beforeItem.price);
  });

  // TEST 7: Owner attempts cross-stall operations through related endpoints -> HTTP 403
  await test('TEST 7a: Owner A attempts to update Stall B status -> HTTP 403', async () => {
    const res = await request('PUT', '/api/stalls/oodles-of-noodles/status', {
      online: false,
      waitTime: 99
    }, {
      'Authorization': `Bearer ${ownerAToken}`
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  await test('TEST 7b: Owner A attempts to add a menu item to Stall B -> HTTP 403', async () => {
    const res = await request('POST', '/api/stalls/oodles-of-noodles/menu', {
      name: 'Unauthorized Cross-Stall Item',
      price: 50
    }, {
      'Authorization': `Bearer ${ownerAToken}`
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  await test('TEST 7c: Owner A attempts to view Stall B orders -> HTTP 403', async () => {
    const res = await request('GET', '/api/orders/stall/oodles-of-noodles', null, {
      'Authorization': `Bearer ${ownerAToken}`
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  await test('TEST 7d: Owner A attempts to delete Stall B menu item -> HTTP 403', async () => {
    const res = await request('DELETE', `/api/menu/${itemB.id}`, null, {
      'Authorization': `Bearer ${ownerAToken}`
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
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
