import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Set test environment
process.env.NODE_ENV = 'test';

function mockReqRes(headers = {}, body = {}) {
  const req = {
    headers: { ...headers },
    body: { ...body }
  };

  const res = {
    statusCode: 200,
    bodyData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.bodyData = data;
      return this;
    }
  };

  let nextCalled = false;
  const next = () => { nextCalled = true; };

  return { req, res, next, isNextCalled: () => nextCalled };
}

async function runSecurityTests() {
  console.log('====================================================');
  console.log('RUNNING STRICT ADMIN ALLOWLIST SECURITY TEST SUITE');
  console.log('====================================================');

  let failures = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ [PASS] ${message}`);
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failures++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Approved Admin - omgarkal357@gmail.com
  // ----------------------------------------------------
  {
    const adminToken = jwt.sign(
      { sub: 'usr-357', email: 'omgarkal357@gmail.com', role: 'admin' },
      config.JWT_SECRET
    );
    const mock1 = mockReqRes({ authorization: `Bearer ${adminToken}` });
    requireAuth(mock1.req, mock1.res, mock1.next);
    assert(mock1.isNextCalled() && mock1.req.user?.role === 'admin', 'Test 1a: requireAuth verifies omgarkal357@gmail.com as admin');

    const mock1b = mockReqRes({ authorization: `Bearer ${adminToken}` });
    mock1b.req.user = mock1.req.user;
    const roleMiddleware = requireRole('admin');
    roleMiddleware(mock1b.req, mock1b.res, mock1b.next);
    assert(mock1b.isNextCalled() && mock1b.res.statusCode === 200, 'Test 1b: requireRole("admin") grants access to omgarkal357@gmail.com');
  }

  // ----------------------------------------------------
  // TEST 2: Second Approved Admin - omgarkal359@gmail.com
  // ----------------------------------------------------
  {
    const adminToken = jwt.sign(
      { sub: 'usr-359', email: 'omgarkal359@gmail.com', role: 'admin' },
      config.JWT_SECRET
    );
    const mock2 = mockReqRes({ authorization: `Bearer ${adminToken}` });
    requireAuth(mock2.req, mock2.res, mock2.next);
    assert(mock2.isNextCalled() && mock2.req.user?.role === 'admin', 'Test 2a: requireAuth verifies omgarkal359@gmail.com as admin');

    const mock2b = mockReqRes({ authorization: `Bearer ${adminToken}` });
    mock2b.req.user = mock2.req.user;
    const roleMiddleware = requireRole('admin');
    roleMiddleware(mock2b.req, mock2b.res, mock2b.next);
    assert(mock2b.isNextCalled() && mock2b.res.statusCode === 200, 'Test 2b: requireRole("admin") grants access to omgarkal359@gmail.com');
  }

  // ----------------------------------------------------
  // TEST 3: Normal Student - student@sguk.ac.in
  // ----------------------------------------------------
  {
    const studentToken = jwt.sign(
      { sub: 'usr-stu', email: 'student@sguk.ac.in', role: 'student' },
      config.JWT_SECRET
    );
    const mock3 = mockReqRes({ authorization: `Bearer ${studentToken}` });
    requireAuth(mock3.req, mock3.res, mock3.next);
    assert(mock3.isNextCalled() && mock3.req.user?.role === 'student', 'Test 3a: Authenticated as student@sguk.ac.in');

    const mock3b = mockReqRes({ authorization: `Bearer ${studentToken}` });
    mock3b.req.user = mock3.req.user;
    const roleMiddleware = requireRole('admin');
    roleMiddleware(mock3b.req, mock3b.res, mock3b.next);
    assert(!mock3b.isNextCalled() && mock3b.res.statusCode === 403, 'Test 3b: student@sguk.ac.in denied admin access with 403 Forbidden');
  }

  // ----------------------------------------------------
  // TEST 4: Random Gmail User Not Allowlisted - randomuser@gmail.com
  // ----------------------------------------------------
  {
    // Even if client forged JWT claim `role: admin` for randomuser@gmail.com
    const forgedToken = jwt.sign(
      { sub: 'usr-rnd', email: 'randomuser@gmail.com', role: 'admin' },
      config.JWT_SECRET
    );
    const mock4 = mockReqRes({ authorization: `Bearer ${forgedToken}` });
    requireAuth(mock4.req, mock4.res, mock4.next);
    assert(mock4.req.user?.role === 'student', 'Test 4a: randomuser@gmail.com role automatically downgraded to student in requireAuth');

    const mock4b = mockReqRes({ authorization: `Bearer ${forgedToken}` });
    mock4b.req.user = mock4.req.user;
    const roleMiddleware = requireRole('admin');
    roleMiddleware(mock4b.req, mock4b.res, mock4b.next);
    assert(!mock4b.isNextCalled() && mock4b.res.statusCode === 403, 'Test 4b: randomuser@gmail.com denied admin access with 403 Forbidden');
  }

  // ----------------------------------------------------
  // TEST 5: Spoofed Admin Email (NO Token / Invalid Token)
  // ----------------------------------------------------
  {
    // Sending req.body.email = omgarkal357@gmail.com and req.body.role = admin without Authorization header
    const mock5 = mockReqRes({}, { email: 'omgarkal357@gmail.com', role: 'admin' });
    requireAuth(mock5.req, mock5.res, mock5.next);
    assert(!mock5.isNextCalled() && mock5.res.statusCode === 401, 'Test 5: Spoofed body without valid JWT returned 401 Unauthorized');
  }

  // ----------------------------------------------------
  // TEST 6: Privilege Escalation
  // ----------------------------------------------------
  {
    // Authenticated non-admin user trying to pass body { role: 'admin' }
    const studentToken = jwt.sign(
      { sub: 'usr-hacker', email: 'hacker@gmail.com', role: 'student' },
      config.JWT_SECRET
    );
    const mock6 = mockReqRes({ authorization: `Bearer ${studentToken}` }, { role: 'admin' });
    requireAuth(mock6.req, mock6.res, mock6.next);
    
    const mock6b = mockReqRes({ authorization: `Bearer ${studentToken}` }, { role: 'admin' });
    mock6b.req.user = mock6.req.user;
    const roleMiddleware = requireRole('admin');
    roleMiddleware(mock6b.req, mock6b.res, mock6b.next);
    
    assert(!mock6b.isNextCalled() && mock6b.res.statusCode === 403, 'Test 6: Privilege escalation attempt rejected with 403 Forbidden');
  }

  console.log('====================================================');
  if (failures === 0) {
    console.log('✅ ALL 6 SECURITY TESTS PASSED SUCCESSFULLY!');
  } else {
    console.error(`❌ SECURITY TEST SUITE FAILED WITH ${failures} FAILURE(S)!`);
    process.exit(1);
  }
  console.log('====================================================');
}

runSecurityTests();
