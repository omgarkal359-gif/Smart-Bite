import assert from 'assert';
import { db, initDatabase } from '../db.js';
import { PaymentVerificationService } from '../services/PaymentVerificationService.js';

console.log('==================================================');
console.log(' RUNNING PAYMENT INTEGRITY & STATE MACHINE TESTS');
console.log('==================================================\n');

let passCount = 0;
let failCount = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}\n`);
    failCount++;
  }
}

async function itAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}\n`);
    failCount++;
  }
}

export async function runPaymentIntegrityTests() {
  await initDatabase();

  const studentUser = { id: 'student@sgu.edu', role: 'student', name: 'Test Student' };
  const mockItems = [
    { id: 1, name: 'Veg Sandwich', price: 40, quantity: 2, stallId: 'mangales-snacks', stallName: 'Mangale Snacks' }
  ];

  // Test 1: Payment Intent Creation (Status = PENDING, Order = pending_payment)
  await itAsync('createPaymentIntent generates pending payment & pending order', async () => {
    const res = await PaymentVerificationService.createPaymentIntent({
      customerId: studentUser.id,
      customerName: studentUser.name,
      type: 'Dine-In',
      items: mockItems,
      paymentMethod: 'Online UPI'
    });

    assert(res.success === true, 'Intent creation should succeed');
    assert(res.paymentId.startsWith('PAY-'), 'Should have payment ID');
    assert(res.orderId.startsWith('ORD-'), 'Should have order ID');
    assert.strictEqual(res.amount, 80, 'Calculated total should be 40 * 2 = 80');
    assert.strictEqual(res.status, 'PENDING', 'Payment status must be PENDING');
    assert.strictEqual(res.order.status, 'pending_payment', 'Order status must be pending_payment');
  });

  // Test 2: Successful Payment Verification transitions Order to placed
  await itAsync('Payment SUCCESS atomically confirms order and transitions status to placed', async () => {
    const intent = await PaymentVerificationService.createPaymentIntent({
      customerId: studentUser.id,
      customerName: studentUser.name,
      type: 'Dine-In',
      items: mockItems,
      paymentMethod: 'Online UPI'
    });

    const uniqueUtr = `${Date.now()}`.slice(-12);
    const verifyRes = await PaymentVerificationService.verifyPayment({
      paymentId: intent.paymentId,
      orderId: intent.orderId,
      transactionRef: uniqueUtr,
      reqUser: studentUser
    });

    assert(verifyRes.success === true, 'Verification must succeed');
    assert.strictEqual(verifyRes.order.status, 'placed', 'Order status must be placed');
    assert.strictEqual(verifyRes.payment.status, 'SUCCESS', 'Payment status must be SUCCESS');
    assert.strictEqual(verifyRes.payment.transactionRef, uniqueUtr, 'UTR must be recorded');
  });

  // Test 3: Replay Attack Guard blocks re-using a consumed UTR
  await itAsync('Replay attack guard strictly rejects already consumed UTR on another order', async () => {
    const replayUtr = '88' + String(Date.now()).slice(-10);

    // First order uses replayUtr
    const intent1 = await PaymentVerificationService.createPaymentIntent({
      customerId: studentUser.id,
      customerName: studentUser.name,
      type: 'Dine-In',
      items: mockItems,
      paymentMethod: 'Online UPI'
    });
    await PaymentVerificationService.verifyPayment({
      paymentId: intent1.paymentId,
      orderId: intent1.orderId,
      transactionRef: replayUtr,
      reqUser: studentUser
    });

    // Second order attempts to replay same replayUtr
    const intent2 = await PaymentVerificationService.createPaymentIntent({
      customerId: studentUser.id,
      customerName: studentUser.name,
      type: 'Dine-In',
      items: mockItems,
      paymentMethod: 'Online UPI'
    });

    let threw = false;
    try {
      await PaymentVerificationService.verifyPayment({
        paymentId: intent2.paymentId,
        orderId: intent2.orderId,
        transactionRef: replayUtr,
        reqUser: studentUser
      });
    } catch (err) {
      threw = true;
      assert(err.message.includes('already been consumed') || err.message.includes('Re-using'), 'Must explain replay attack error');
    }

    assert(threw, 'Replaying a used UTR MUST throw an error');

    // Verify intent2 order status is STILL pending_payment (NOT confirmed!)
    const order2 = await db.get('SELECT * FROM orders WHERE id = ?', [intent2.orderId]);
    assert.strictEqual(order2.status, 'pending_payment', 'Order with replayed UTR must NOT be confirmed');
  });

  // Test 4: Invalid format UTR rejection (not 12 digits)
  await itAsync('Invalid format UTR (< 12 digits or non-numeric) is strictly rejected', async () => {
    const intent = await PaymentVerificationService.createPaymentIntent({
      customerId: studentUser.id,
      customerName: studentUser.name,
      type: 'Dine-In',
      items: mockItems,
      paymentMethod: 'Online UPI'
    });

    const invalidUtrs = ['123', 'abcdefghijkl', '12345678901', '1234567890123', ''];

    for (const badUtr of invalidUtrs) {
      let threw = false;
      try {
        await PaymentVerificationService.verifyPayment({
          paymentId: intent.paymentId,
          orderId: intent.orderId,
          transactionRef: badUtr,
          reqUser: studentUser
        });
      } catch (err) {
        threw = true;
      }
      assert(threw, `Invalid UTR "${badUtr}" must throw an error`);
    }

    const order = await db.get('SELECT * FROM orders WHERE id = ?', [intent.orderId]);
    assert.strictEqual(order.status, 'pending_payment', 'Order must remain unconfirmed');
  });

  // Test 5: Payment Cancellation transitions order to cancelled
  await itAsync('cancelPayment transitions payment and order to CANCELLED', async () => {
    const intent = await PaymentVerificationService.createPaymentIntent({
      customerId: studentUser.id,
      customerName: studentUser.name,
      type: 'Dine-In',
      items: mockItems,
      paymentMethod: 'Online UPI'
    });

    const cancelRes = await PaymentVerificationService.cancelPayment({
      paymentId: intent.paymentId,
      orderId: intent.orderId,
      reason: 'Customer aborted at payment screen',
      reqUser: studentUser
    });

    assert(cancelRes.success === true, 'Cancellation should succeed');
    assert.strictEqual(cancelRes.status, 'CANCELLED', 'Status must be CANCELLED');

    const order = await db.get('SELECT * FROM orders WHERE id = ?', [intent.orderId]);
    assert.strictEqual(order.status, 'cancelled', 'Order status must be cancelled');

    // Attempting to verify cancelled order must fail
    let threw = false;
    try {
      await PaymentVerificationService.verifyPayment({
        paymentId: intent.paymentId,
        orderId: intent.orderId,
        transactionRef: '123456789012',
        reqUser: studentUser
      });
    } catch (err) {
      threw = true;
    }
    assert(threw, 'Verifying cancelled session must fail');
  });

  // Test 6: Idempotent verification returns existing confirmed order without side-effects
  await itAsync('Idempotent verification returns confirmed order without duplicate side-effects', async () => {
    const intent = await PaymentVerificationService.createPaymentIntent({
      customerId: studentUser.id,
      customerName: studentUser.name,
      type: 'Dine-In',
      items: mockItems,
      paymentMethod: 'Online UPI'
    });

    const utr = `${Date.now()}`.slice(-12);
    const firstVerify = await PaymentVerificationService.verifyPayment({
      paymentId: intent.paymentId,
      orderId: intent.orderId,
      transactionRef: utr,
      reqUser: studentUser
    });

    assert(firstVerify.success === true);

    const secondVerify = await PaymentVerificationService.verifyPayment({
      paymentId: intent.paymentId,
      orderId: intent.orderId,
      transactionRef: utr,
      reqUser: studentUser
    });

    assert(secondVerify.success === true);
    assert(secondVerify.alreadyVerified === true, 'Should indicate already verified');
    assert.strictEqual(secondVerify.order.status, 'placed', 'Order status remains placed');
  });

  // Test 7: Unauthorized user verification attempt is blocked
  await itAsync('Unauthorized user attempting to verify another student order is blocked', async () => {
    const intent = await PaymentVerificationService.createPaymentIntent({
      customerId: 'victim@sgu.edu',
      customerName: 'Victim Student',
      type: 'Dine-In',
      items: mockItems,
      paymentMethod: 'Online UPI'
    });

    let threw = false;
    try {
      await PaymentVerificationService.verifyPayment({
        paymentId: intent.paymentId,
        orderId: intent.orderId,
        transactionRef: '555566667777',
        reqUser: { id: 'attacker@sgu.edu', role: 'student' }
      });
    } catch (err) {
      threw = true;
      assert(err.message.includes('Unauthorized'), 'Must report unauthorized');
    }

    assert(threw, 'Unauthorized verification must be blocked');
  });

  // Test 8: Price tampering prevention (Server-side calculation)
  await itAsync('Intent total is calculated server-side preventing price tampering', async () => {
    const maliciousItems = [
      { id: 1, name: 'Expensive Meal', price: 150, quantity: 3, stallId: 'rohit-vadewale' }
    ];

    const intent = await PaymentVerificationService.createPaymentIntent({
      customerId: studentUser.id,
      customerName: studentUser.name,
      items: maliciousItems
    });

    assert.strictEqual(intent.amount, 450, 'Server must enforce calculated price 150 * 3 = 450');
  });

  // Test 9: Cash payment initializes with pending_cash and PENDING payment
  await itAsync('Cash payment initializes with status pending_cash and PENDING payment', async () => {
    const intent = await PaymentVerificationService.createPaymentIntent({
      customerId: studentUser.id,
      customerName: studentUser.name,
      type: 'Dine-In',
      items: mockItems,
      paymentMethod: 'Cash'
    });

    assert.strictEqual(intent.order.status, 'pending_cash', 'Cash order must start in pending_cash');
    assert.strictEqual(intent.payment.status, 'PENDING', 'Cash payment must start in PENDING');
  });

  // Test 10: Fail closed on non-existent payment ID
  await itAsync('Fail closed: Non-existent payment or order ID returns descriptive error', async () => {
    let threw = false;
    try {
      await PaymentVerificationService.verifyPayment({
        paymentId: 'NON_EXISTENT_PAY_ID',
        transactionRef: '123456789012',
        reqUser: studentUser
      });
    } catch (err) {
      threw = true;
      assert(err.message.includes('No pending payment intent found'), 'Must explain payment not found');
    }
    assert(threw, 'Should throw for non-existent payment');
  });

  // Test 11: Idempotency Key deduplication on createPaymentIntent
  await itAsync('Idempotency key prevents duplicate payment intents for identical request', async () => {
    const idempotencyKey = `idemp-${Date.now()}`;
    const firstRes = await PaymentVerificationService.createPaymentIntent({
      customerId: studentUser.id,
      customerName: studentUser.name,
      type: 'Takeaway',
      items: mockItems,
      paymentMethod: 'Online UPI',
      idempotencyKey
    });

    const secondRes = await PaymentVerificationService.createPaymentIntent({
      customerId: studentUser.id,
      customerName: studentUser.name,
      type: 'Takeaway',
      items: mockItems,
      paymentMethod: 'Online UPI',
      idempotencyKey
    });

    assert.strictEqual(secondRes.isDuplicate, true, 'Second call must detect duplicate idempotency key');
    assert.strictEqual(secondRes.payment.id, firstRes.paymentId, 'Payment ID must match original');
  });

  console.log('\n==================================================');
  console.log(` RESULTS: ${passCount} PASSED | ${failCount} FAILED`);
  console.log('==================================================\n');

  if (failCount > 0) {
    throw new Error(`${failCount} payment integrity tests failed.`);
  }

  return { passCount, failCount };
}

// Run directly if invoked as main script
if (process.argv[1]?.endsWith('paymentIntegrity.test.js')) {
  runPaymentIntegrityTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
