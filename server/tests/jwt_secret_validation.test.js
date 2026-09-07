import jwt from 'jsonwebtoken';
import { config, validateJwtSecret } from '../config.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Prevent process.exit during test execution
process.env.NODE_ENV = 'test';
process.env.SUPPRESS_STARTUP_EXIT = 'true';

const OLD_COMPROMISED_SECRET = 'smartbite_enterprise_jwt_secret_sgu_2026_prod_secure';

function mockReqRes(headers = {}) {
  const req = {
    headers: { ...headers },
    body: {}
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

async function runJwtValidationTests() {
  console.log('====================================================');
  console.log('RUNNING OWASP A04 JWT SECRET VALIDATION TEST SUITE');
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
  // TEST 1: Missing JWT_SECRET -> Startup Fails
  // ----------------------------------------------------
  try {
    validateJwtSecret(undefined);
    assert(false, 'Test 1: Missing JWT_SECRET should throw fatal error');
  } catch (err) {
    assert(err.message.includes('required'), 'Test 1: Missing JWT_SECRET threw fatal startup configuration error');
  }

  // ----------------------------------------------------
  // TEST 2: Empty JWT_SECRET -> Startup Fails
  // ----------------------------------------------------
  try {
    validateJwtSecret('');
    assert(false, 'Test 2: Empty JWT_SECRET should throw fatal error');
  } catch (err) {
    assert(err.message.includes('required'), 'Test 2: Empty JWT_SECRET threw fatal startup configuration error');
  }

  // ----------------------------------------------------
  // TEST 3: Whitespace JWT_SECRET -> Startup Fails
  // ----------------------------------------------------
  try {
    validateJwtSecret('   ');
    assert(false, 'Test 3: Whitespace JWT_SECRET should throw fatal error');
  } catch (err) {
    assert(err.message.includes('required'), 'Test 3: Whitespace JWT_SECRET threw fatal startup configuration error');
  }

  // ----------------------------------------------------
  // TEST 4: Known Insecure Secret -> Startup Fails
  // ----------------------------------------------------
  try {
    validateJwtSecret(OLD_COMPROMISED_SECRET);
    assert(false, 'Test 4: Compromised fallback JWT_SECRET should throw fatal error');
  } catch (err) {
    assert(err.message.includes('known insecure secret'), 'Test 4: Compromised fallback JWT_SECRET threw fatal startup error');
  }

  // ----------------------------------------------------
  // TEST 5: Short Secret (<32 chars) -> Startup Fails
  // ----------------------------------------------------
  try {
    validateJwtSecret('short_secret_123');
    assert(false, 'Test 5: Short JWT_SECRET should throw fatal error');
  } catch (err) {
    assert(err.message.includes('at least 32 characters'), 'Test 5: Short JWT_SECRET (<32 chars) threw fatal entropy error');
  }

  // ----------------------------------------------------
  // TEST 6: Valid High-Entropy Secret -> Validation Succeeds
  // ----------------------------------------------------
  try {
    const validSecret = 'f98d7a12b4e6c380921475ef10a9c8b327d4e5f60819203142536475869a0b1c';
    const validated = validateJwtSecret(validSecret);
    assert(validated === validSecret, 'Test 6: Valid high-entropy JWT_SECRET accepted by startup validator');
  } catch (err) {
    assert(false, `Test 6: Valid secret failed with error: ${err.message}`);
  }

  // ----------------------------------------------------
  // TEST 7: JWT Generation & Verification with Active Secret
  // ----------------------------------------------------
  let activeToken = null;
  try {
    activeToken = jwt.sign(
      { sub: 'usr-999', email: 'omgarkal357@gmail.com', role: 'admin' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '1h' }
    );
    const decoded = jwt.verify(activeToken, config.JWT_SECRET, { algorithms: ['HS256'] });
    assert(decoded.email === 'omgarkal357@gmail.com' && decoded.role === 'admin', 'Test 7: Token generated and verified with active HS256 secret');
  } catch (err) {
    assert(false, `Test 7: Token signing/verification failed: ${err.message}`);
  }

  // ----------------------------------------------------
  // TEST 8: Token Signed with Compromised Old Secret -> REJECTED
  // ----------------------------------------------------
  {
    const oldForgedToken = jwt.sign(
      { sub: 'usr-attacker', email: 'omgarkal357@gmail.com', role: 'admin' },
      OLD_COMPROMISED_SECRET,
      { algorithm: 'HS256' }
    );

    let rejectedByJwtVerify = false;
    try {
      jwt.verify(oldForgedToken, config.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (err) {
      rejectedByJwtVerify = true;
    }
    assert(rejectedByJwtVerify, 'Test 8a: Token signed with old compromised secret rejected by jwt.verify');

    const mock8 = mockReqRes({ authorization: `Bearer ${oldForgedToken}` });
    requireAuth(mock8.req, mock8.res, mock8.next);
    assert(!mock8.isNextCalled() && mock8.res.statusCode === 401, 'Test 8b: Token signed with old compromised secret rejected with 401 Unauthorized');
  }

  // ----------------------------------------------------
  // TEST 9: Tampered Signature -> REJECTED
  // ----------------------------------------------------
  {
    const parts = activeToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'usr-999', email: 'omgarkal357@gmail.com', role: 'admin', tampered: true })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const mock9 = mockReqRes({ authorization: `Bearer ${tamperedToken}` });
    requireAuth(mock9.req, mock9.res, mock9.next);
    assert(!mock9.isNextCalled() && mock9.res.statusCode === 401, 'Test 9: Tampered token signature rejected with 401 Unauthorized');
  }

  // ----------------------------------------------------
  // TEST 10: Expired Token -> REJECTED
  // ----------------------------------------------------
  {
    const expiredToken = jwt.sign(
      { sub: 'usr-123', email: 'omgarkal357@gmail.com', role: 'admin' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '-10s' }
    );

    const mock10 = mockReqRes({ authorization: `Bearer ${expiredToken}` });
    requireAuth(mock10.req, mock10.res, mock10.next);
    assert(!mock10.isNextCalled() && mock10.res.statusCode === 401, 'Test 10: Expired token rejected with 401 Unauthorized');
  }

  console.log('====================================================');
  if (failures === 0) {
    console.log('✅ ALL 10 JWT SECURITY & VALIDATION TESTS PASSED!');
  } else {
    console.error(`❌ JWT SECURITY TEST SUITE FAILED WITH ${failures} FAILURE(S)!`);
    process.exit(1);
  }
  console.log('====================================================');
}

runJwtValidationTests();
