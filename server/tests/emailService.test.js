import emailService from '../services/EmailService.js';

async function runEmailTests() {
  console.log('==================================================');
  console.log(' RUNNING EMAIL SERVICE TEMPLATE TESTS');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  // Test 1: Order Confirmation Receipt
  await test('Render order-confirmation digital receipt', async () => {
    const html = await emailService.renderTemplate('order-confirmation', {
      order: { id: 'TEST-12345' },
      items: [{ name: 'Veg Cheese Pizza', price: 180, quantity: 2, stallName: 'Domino Special' }],
      shopName: 'Domino Special',
      paymentMethod: 'UPI',
      customerName: 'Satej Shinde',
      subtotal: '342.86',
      gst: '17.14',
      total: '360.00',
      dateFormatted: '03/08/2026, 11:30 PM',
    });
    if (!html.includes('TEST-12345')) throw new Error('Order ID missing from receipt template output.');
    if (!html.includes('VEG CHEESE PIZZA')) throw new Error('Item name missing from receipt template output.');
    if (!html.includes('SATEJ SHINDE')) throw new Error('Customer name missing from receipt template output.');
    if (!html.includes('360.00')) throw new Error('Total price missing from receipt template output.');
  });

  // Test 2: Password Reset
  await test('Render password-reset email card', async () => {
    const html = await emailService.renderTemplate('password-reset', {
      actionLink: 'https://smart-bite-rosy.vercel.app/reset-password?token=abc123token',
      userName: 'Satej',
    });
    if (!html.includes('abc123token')) throw new Error('Action link token missing.');
    if (!html.includes('Hello Satej!')) throw new Error('Greeting name missing.');
  });

  // Test 3: Welcome Email
  await test('Render welcome email', async () => {
    const html = await emailService.renderTemplate('welcome', {
      userName: 'Divya',
      loginLink: 'https://smart-bite-rosy.vercel.app/login',
    });
    if (!html.includes('Divya')) throw new Error('User name missing from welcome email.');
    if (!html.includes('Welcome to SGU Smart-Bite!')) throw new Error('Welcome header missing.');
  });

  // Test 4: OTP Verification
  await test('Render OTP verification email', async () => {
    const html = await emailService.renderTemplate('otp', {
      otp: '739105',
      userName: 'Student User',
      expiryMinutes: 5,
    });
    if (!html.includes('739105')) throw new Error('OTP code missing.');
    if (!html.includes('5 minutes')) throw new Error('Expiry time missing.');
  });

  // Test 5: Email Verification Link
  await test('Render email-verification email', async () => {
    const html = await emailService.renderTemplate('email-verification', {
      verificationLink: 'https://smart-bite-rosy.vercel.app/verify?token=verify99',
      userName: 'Akash',
    });
    if (!html.includes('verify99')) throw new Error('Verification link missing.');
  });

  // Test 6: Contact Form
  await test('Render contact-form message', async () => {
    const html = await emailService.renderTemplate('contact-form', {
      senderName: 'John Doe',
      senderEmail: 'john@example.com',
      subject: 'Feedback regarding payment options',
      message: 'Great app experience!',
    });
    if (!html.includes('John Doe')) throw new Error('Sender name missing.');
    if (!html.includes('Great app experience!')) throw new Error('Message content missing.');
  });

  // Test 7: Notification Email
  await test('Render notification email', async () => {
    const html = await emailService.renderTemplate('notification', {
      title: 'Order Status Update',
      message: 'Your order is now READY for pickup!',
      actionUrl: 'https://smart-bite-rosy.vercel.app/orders/123',
    });
    if (!html.includes('READY for pickup!')) throw new Error('Notification message missing.');
  });

  // Test 8: Admin Alert
  await test('Render admin-email template', async () => {
    const html = await emailService.renderTemplate('admin-email', {
      subject: 'High Traffic Alert',
      message: 'Server load reached 85%',
    });
    if (!html.includes('High Traffic Alert')) throw new Error('Admin subject missing.');
  });

  // Test 9: Invitation Email
  await test('Render invitation email', async () => {
    const html = await emailService.renderTemplate('invitation', {
      inviteeName: 'Stall Manager',
      role: 'Vendor Admin',
      stallName: 'Rolls & Bowls',
      inviteLink: 'https://smart-bite-rosy.vercel.app/invite?id=77',
    });
    if (!html.includes('Rolls')) throw new Error('Stall name missing.');
  });

  // Test 10: Non-existent Template handling
  await test('Throw error on missing template', async () => {
    try {
      await emailService.renderTemplate('non-existent-template');
      throw new Error('Expected method to throw error for missing template.');
    } catch (err) {
      if (!err.message.includes('not found')) throw err;
    }
  });

  console.log('\n==================================================');
  console.log(` RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runEmailTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
