import app from '../server.js';
import { db, initDatabase } from '../db.js';
import http from 'http';

async function runE2ETests() {
  console.log('\n==================================================');
  console.log(' STARTING COMPREHENSIVE END-TO-END FLOW VERIFICATION');
  console.log('==================================================\n');

  // 1. Start test HTTP server
  console.log('[E2E 1] Starting backend HTTP server on dynamic port...');
  await initDatabase();
  
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`  ✓ Server running on ${baseUrl}`);

  // Test Database Query
  const dbCheck = await db.get('SELECT 1 as alive');
  console.log('  ✓ DB Connection & Query Success! Engine responsive.');


  // 2. Test User Registration
  const testStudentEmail = `e2e_student_${Date.now()}@sgu.ac.in`;
  const testPassword = 'SecurePassword123!';
  console.log(`\n[E2E 2] Testing User Registration (${testStudentEmail})...`);
  
  let res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testStudentEmail,
      name: 'E2E Test Student',
      password: testPassword,
      role: 'student'
    })
  });
  let body = await res.json();
  console.log(`  Status: ${res.status}`);
  if (res.status !== 200 || !body.token) {
    console.error('  ❌ Registration Failed:', body);
    server.close();
    process.exit(1);
  }
  console.log('  ✓ Registration SUCCESS! Token received.');

  // 3. Test Student Password Login
  console.log(`\n[E2E 3] Testing Valid Student Login...`);
  res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testStudentEmail,
      password: testPassword,
      role: 'student'
    })
  });
  body = await res.json();
  console.log(`  Status: ${res.status}`);
  if (res.status !== 200 || !body.token) {
    console.error('  ❌ Student Login Failed:', body);
    server.close();
    process.exit(1);
  }
  const studentToken = body.token;
  console.log('  ✓ Login SUCCESS! User role:', body.user.role);

  // 4. Test Invalid Password Login
  console.log(`\n[E2E 4] Testing Invalid Credentials Login (Wrong Password)...`);
  res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: testStudentEmail,
      password: 'WrongPassword999!',
      role: 'student'
    })
  });
  console.log(`  Status: ${res.status}`);
  if (res.status === 401) {
    console.log('  ✓ Invalid Password Rejected correctly with HTTP 401!');
  } else {
    console.error('  ❌ Expected 401 but got:', res.status);
    server.close();
    process.exit(1);
  }

  // 5. Test Google Login (Student Email)
  console.log(`\n[E2E 5] Testing Google Login for @sguk.ac.in Student...`);
  const googleStudentEmail = `student_${Date.now()}@sguk.ac.in`;
  res = await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: googleStudentEmail,
      name: 'Google Student'
    })
  });
  body = await res.json();
  console.log(`  Status: ${res.status}`);
  if (res.status !== 200 || !body.token) {
    console.error('  ❌ Google Login Failed:', body);
    server.close();
    process.exit(1);
  }
  console.log('  ✓ Google Student Login SUCCESS! Role:', body.user.role);

  // 6. Test Google Login (Admin Whitelisted Email)
  console.log(`\n[E2E 6] Testing Google Login for Admin Whitelisted Email (omgarkal357@gmail.com)...`);
  res = await fetch(`${baseUrl}/api/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'omgarkal357@gmail.com',
      name: 'Om Garkal Admin'
    })
  });
  body = await res.json();
  console.log(`  Status: ${res.status}`);
  if (res.status !== 200 || body.user.role !== 'admin') {
    console.error('  ❌ Admin Google Login Failed:', body);
    server.close();
    process.exit(1);
  }
  const adminToken = body.token;
  console.log('  ✓ Admin Google Login SUCCESS! Assigned Role:', body.user.role);

  // 7. Test JWT Verification via /api/auth/me
  console.log(`\n[E2E 7] Testing Token Verification (/api/auth/me)...`);
  res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  body = await res.json();
  console.log(`  Status: ${res.status}`);
  if (res.status !== 200 || body.user.username.toLowerCase() !== testStudentEmail.toLowerCase()) {
    console.error('  ❌ /api/auth/me Token Verification Failed:', body);
    server.close();
    process.exit(1);
  }
  console.log('  ✓ Token Verification SUCCESS! User:', body.user.username);

  // 8. Test Malformed Token Rejection
  console.log(`\n[E2E 8] Testing Invalid Token Rejection...`);
  res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': 'Bearer invalid_bogus_token_123' }
  });
  console.log(`  Status: ${res.status}`);
  if (res.status === 401) {
    console.log('  ✓ Malformed Token Rejected correctly with HTTP 401!');
  } else {
    console.error('  ❌ Expected 401 but got:', res.status);
    server.close();
    process.exit(1);
  }

  // 9. Test Authorization Guard (Student accessing Admin route)
  console.log(`\n[E2E 9] Testing Authorization Guard (Student accessing /api/admin/metrics)...`);
  res = await fetch(`${baseUrl}/api/admin/metrics`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log(`  Status: ${res.status}`);
  if (res.status === 403) {
    console.log('  ✓ Unauthorized Access Blocked correctly with HTTP 403 Forbidden!');
  } else {
    console.error('  ❌ Expected 403 but got:', res.status);
    server.close();
    process.exit(1);
  }

  // 10. Test Admin Access
  console.log(`\n[E2E 10] Testing Admin Access (/api/admin/metrics)...`);
  res = await fetch(`${baseUrl}/api/admin/metrics`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  console.log(`  Status: ${res.status}`);
  if (res.status !== 200) {
    console.error('  ❌ Admin Metrics Access Failed');
    server.close();
    process.exit(1);
  }
  console.log('  ✓ Admin Metrics Access SUCCESS!');

  // 11. Test Authenticated Order Placement (CRUD)
  console.log(`\n[E2E 11] Testing Authenticated Order Placement (CRUD)...`);
  const menuRes = await fetch(`${baseUrl}/api/stalls/mangales-snacks/menu`);
  const menuData = await menuRes.json();
  const sampleItem = menuData[0] || { id: 1, name: 'Dahi Thalipeeth', price: 50, stallId: 'mangales-snacks', stallName: 'Mangale Snacks' };
  
  res = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${studentToken}`
    },
    body: JSON.stringify({
      customerName: 'E2E Test Student',
      customerId: testStudentEmail,
      type: 'Dine-In',
      payment: 'Cash',
      total: sampleItem.price * 1,
      items: [
        {
          id: sampleItem.id,
          name: sampleItem.name,
          price: sampleItem.price,
          quantity: 1,
          stallId: sampleItem.stallId || 'mangales-snacks',
          stallName: sampleItem.stallName || 'Mangale Snacks'
        }
      ]
    })
  });
  body = await res.json();
  console.log(`  Status: ${res.status}`);
  if (res.status !== 200 || !body.id) {
    console.error('  ❌ Order Creation Failed:', body);
    server.close();
    process.exit(1);
  }
  console.log(`  ✓ Authenticated Order Created SUCCESS! Order ID: ${body.id}`);


  // 12. Test Cross-Student History Protection
  console.log(`\n[E2E 12] Testing Student Order Access Isolation...`);
  res = await fetch(`${baseUrl}/api/orders/student/${googleStudentEmail}`, {
    headers: { 'Authorization': `Bearer ${studentToken}` }
  });
  console.log(`  Status: ${res.status}`);
  if (res.status === 403) {
    console.log('  ✓ Cross-Student Order Access Blocked correctly with HTTP 403 Forbidden!');
  } else {
    console.error('  ❌ Expected 403 but got:', res.status);
    server.close();
    process.exit(1);
  }

  console.log('\n==================================================');
  console.log(' ALL 12 E2E FLOW VERIFICATIONS PASSED 100% SUCCESSFULLY');
  console.log('==================================================\n');
  server.close();
  process.exit(0);
}

runE2ETests().catch(err => {
  console.error('E2E Test Runner Fatal Error:', err);
  process.exit(1);
});
