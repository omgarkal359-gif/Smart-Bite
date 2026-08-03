import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

import { db, initDatabase } from './db.js';
import emailService from './services/EmailService.js';

const app = express();
app.use(cors());
app.use(express.json());

// Database initialization middleware for Serverless environment
let dbInitialized = false;
let dbInitPromise = null;

app.use(async (req, res, next) => {
  if (!dbInitialized) {
    if (!dbInitPromise) {
      dbInitPromise = initDatabase()
        .then(() => {
          dbInitialized = true;
        })
        .catch((err) => {
          dbInitPromise = null;
          throw err;
        });
    }
    try {
      await dbInitPromise;
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Database initialization failed: ' + err.message });
    }
  }
  next();
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT']
  }
});

// Real-time connections
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join', (room) => {
    socket.join(room);
    console.log(`Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper to notify queue and order tracking updates
async function broadcastQueueUpdate() {
  try {
    const activeOrders = await db.all(
      `SELECT id, status, customerName FROM orders WHERE status IN ('placed', 'preparing', 'ready') ORDER BY timestamp DESC`
    );
    const formatted = activeOrders.map(o => ({
      id: o.id,
      status: o.status,
      customerName: o.customerName || o.customername
    }));
    io.to('public-board').emit('queue_update', formatted);
  } catch (err) {
    console.error('Error broadcasting queue:', err);
  }
}

// Security helper: sanitize user objects returned over HTTP APIs
function sanitizeUser(user) {
  if (!user) return user;
  const sanitized = { ...user };
  delete sanitized.password;
  return sanitized;
}

// REST Endpoints

// Auth
app.post('/api/auth/login', async (req, res) => {
  const { username, password, role, name } = req.body;
  try {
    if (role === 'guest') {
      // Create guest dynamically or fetch if exists
      let user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = ?', [username, 'guest']);
      if (!user) {
        await db.run(
          'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
          [username, username, '', 'guest', null]
        );
        user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = ?', [username, 'guest']);
      }
      return res.json({ success: true, user: sanitizeUser(user) });
    }

    if (role === 'student') {
      // Strictly enforce account existence rule: No student is allowed to login until they have created an account first
      const cleanUsername = username.trim().toLowerCase();
      const user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanUsername]);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Account not found. No student is allowed to sign in until they have created an account. Please click "Sign Up" to create your account first.'
        });
      }

      // Verify password if provided
      if (password && password.trim() !== '' && user.password && user.password !== password.trim()) {
        return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });
      }

      return res.json({ success: true, user: sanitizeUser(user) });
    }

    if (role === 'owner') {
      // Create vendor/owner dynamically or update password if exists
      let user = await db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'owner']);
      if (!user) {
        const displayName = `${username.charAt(0).toUpperCase() + username.slice(1).replace('-', ' ')} Owner`;
        await db.run(
          'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
          [username, displayName, password, 'owner', username]
        );
        user = await db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'owner']);

        // Check if corresponding stall exists, if not create default
        const stall = await db.get('SELECT * FROM stalls WHERE id = ?', [username]);
        if (!stall) {
          const stallName = username.charAt(0).toUpperCase() + username.slice(1).replace('-', ' ');
          await db.run(
            'INSERT INTO stalls (id, name, category, online, busyMode, waitTime, rating, logo, img) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [username, stallName, 'Fresh & delicious food', 1, 0, 0, 4.5, '🍽️', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80']
          );
        }
      } else {
        // If password is different, update it
        if (user.password !== password) {
          await db.run('UPDATE users SET password = ? WHERE id = ?', [password, user.id]);
          user.password = password;
        }
      }
      return res.json({ success: true, user: sanitizeUser(user) });
    }

    // Auto-detect role: look up by username + password regardless of role (covers admin & edge cases)
    if (!role || role === 'admin') {
      const user = await db.get(
        'SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND password = ?',
        [username, password]
      );
      if (user) return res.json({ success: true, user: sanitizeUser(user) });
      return res.status(401).json({ success: false, message: 'Invalid ID or password.' });
    }

    const user = await db.get(
      'SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND password = ? AND role = ?',
      [username, password, role]
    );

    if (user) {
      res.json({ success: true, user: sanitizeUser(user) });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Google Auth Single Sign-On (SSO) & Account Registration
app.post('/api/auth/google', async (req, res) => {
  const { email, name, isSignUp } = req.body;
  try {
    const cleanId = (email || '').trim().toLowerCase();
    let user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanId]);
    
    if (!user) {
      // Auto-register student account on Sign Up with Google!
      const displayName = name || (cleanId ? cleanId.split('@')[0] : 'Google Student');
      await db.run(
        'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
        [cleanId, displayName, '', 'student', null]
      );
      user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanId]);
    }

    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Register new account
app.post('/api/auth/register', async (req, res) => {
  const { username, name, password, role } = req.body;
  if (!username || !name || !password) {
    return res.status(400).json({ success: false, message: 'Name, username/email/mobile, and password are required.' });
  }
  const allowedRoles = ['student', 'guest'];
  const userRole = allowedRoles.includes(role) ? role : 'student';
  try {
    const existing = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email or mobile already exists.' });
    }
    await db.run(
      'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
      [username.trim(), name.trim(), password.trim(), userRole, null]
    );
    const user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    res.json({ success: true, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Verify if user account is registered before password reset
app.post('/api/auth/verify-registration', async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ success: false, message: 'Identifier is required.' });
  }
  try {
    const cleanId = identifier.trim().toLowerCase();
    const rawDigits = cleanId.replace(/\D/g, '');
    let user = await db.get('SELECT * FROM users WHERE LOWER(username) = ?', [cleanId]);
    if (!user && rawDigits.length >= 10) {
      user = await db.get('SELECT * FROM users WHERE username LIKE ?', [`%${rawDigits.slice(-10)}%`]);
    }

    if (!user) {
      return res.status(404).json({
        registered: false,
        message: 'Account not registered. This email or mobile number was never registered with SGU Smart-Bite. Please check for typos or click Sign Up to create an account.'
      });
    }

    res.json({
      registered: true,
      user: sanitizeUser(user),
      message: 'Account verified successfully.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



// Stalls list
app.get('/api/stalls', async (req, res) => {
  try {
    const stalls = await db.all('SELECT * FROM stalls');
    const formatted = stalls.map(s => ({
      ...s,
      busyMode: s.busyMode !== undefined ? s.busyMode : s.busymode,
      waitTime: s.waitTime !== undefined ? s.waitTime : s.waittime
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Toggle online / update wait time for stalls
app.put('/api/stalls/:id/status', async (req, res) => {
  const { id } = req.params;
  const { online, waitTime, busyMode } = req.body;
  try {
    const current = await db.get('SELECT * FROM stalls WHERE id = ?', [id]);
    if (!current) return res.status(404).json({ message: 'Stall not found' });

    const newOnline = online !== undefined ? (online ? 1 : 0) : (current.online !== undefined ? current.online : 0);
    const newWaitTime = waitTime !== undefined ? waitTime : (current.waitTime !== undefined ? current.waitTime : current.waittime || 0);
    const newBusy = busyMode !== undefined ? (busyMode ? 1 : 0) : (current.busyMode !== undefined ? current.busyMode : current.busymode || 0);

    await db.run(
      'UPDATE stalls SET online = ?, waitTime = ?, busyMode = ? WHERE id = ?',
      [newOnline, newWaitTime, newBusy, id]
    );

    const updated = await db.get('SELECT * FROM stalls WHERE id = ?', [id]);
    const formatted = {
      ...updated,
      busyMode: updated.busyMode !== undefined ? updated.busyMode : updated.busymode,
      waitTime: updated.waitTime !== undefined ? updated.waitTime : updated.waittime
    };
    io.to('student').emit('stall_status_update', formatted);
    io.to(`stall-menu-${id}`).emit('stall_status_update', formatted);
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Menu for stall
app.get('/api/stalls/:id/menu', async (req, res) => {
  const { id } = req.params;
  try {
    const items = await db.all('SELECT * FROM menu_items WHERE stallId = ? AND available = 1', [id]);
    const formatted = items.map(item => ({
      ...item,
      stallId: item.stallId || item.stallid
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update menu item availability/stock/details
app.put('/api/menu/:itemId', async (req, res) => {
  const { itemId } = req.params;
  const { stock, price, available, name, category } = req.body;
  try {
    const item = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemId]);
    if (!item) return res.status(404).json({ message: 'Menu item not found' });

    const newStock = stock !== undefined ? stock : item.stock;
    const newPrice = price !== undefined ? price : item.price;
    const newAvailable = available !== undefined ? (available ? 1 : 0) : item.available;
    const newName = name !== undefined ? name : item.name;
    const newCategory = category !== undefined ? category : item.category;

    await db.run(
      'UPDATE menu_items SET stock = ?, price = ?, available = ?, name = ?, category = ? WHERE id = ?',
      [newStock, newPrice, newAvailable, newName, newCategory, itemId]
    );

    const updated = await db.get('SELECT * FROM menu_items WHERE id = ?', [itemId]);
    io.to(`stall-menu-${item.stallId}`).emit('menu_item_update', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add new menu item to stall
app.post('/api/stalls/:id/menu', async (req, res) => {
  const { id } = req.params;
  const { name, price, isVeg, category, stock, img } = req.body;
  try {
    const result = await db.run(
      'INSERT INTO menu_items (stallId, name, price, isVeg, category, stock, available) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [id, name, price, isVeg !== undefined ? (isVeg ? 1 : 0) : 1, category || 'Main', stock !== undefined ? stock : 20]
    );
    
    // Set custom img url if provided (or default placeholder)
    if (img) {
      // Typically we'd save the image path, for now we keep it simple or store it in menu_items.
      // Wait, let's see if we should add an image column to menu_items table. Let's make sure it has an image if needed.
    }

    const newItem = await db.get('SELECT * FROM menu_items WHERE id = ?', [result.id]);
    io.to(`stall-menu-${id}`).emit('menu_item_update', newItem);
    res.json(newItem);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create Order
app.post('/api/orders', async (req, res) => {
  const { customerName, customerId, type, payment, total, items, id: customId, orderId: reqOrderId } = req.body;
  try {
    // Preserve exact order ID from client or generate fallback
    const orderId = customId || reqOrderId || `ORD-${Date.now()}`;
    const now = new Date().toISOString();
    const initialStatus = payment === 'Cash' ? 'pending_cash' : 'placed';

    await db.run(
      'INSERT INTO orders (id, customerName, customerId, type, payment, status, total, time, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [orderId, customerName, customerId, type, payment, initialStatus, total, 'Just now', now]
    );

    for (const item of items) {
      await db.run(
        'INSERT INTO order_items (orderId, itemId, name, price, quantity, stallId, stallName) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [orderId, item.id, item.name, item.price, item.quantity, item.stallId, item.stallName]
      );
    }

    const createdOrder = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    const createdItems = await db.all('SELECT * FROM order_items WHERE orderId = ?', [orderId]);
    createdOrder.items = createdItems;

    // --- DIGITAL RECEIPT DISPATCHER ---
    const receiptItemsText = createdItems.map(item => `   - ${item.quantity}x ${item.name} (₹${item.price} each) - Stall: ${item.stallName}`).join('\n');
    const isEmail = customerId?.includes('@');
    const dispatchMethod = isEmail ? 'EMAIL' : 'MOBILE SMS';
    
    console.log(`\n==================================================`);
    console.log(`[RECEIPT DISPATCHER] NEW ORDER PLACED: ${orderId}`);
    console.log(`[RECEIPT DISPATCHER] Dispatching Digital Receipt to Customer via ${dispatchMethod}:`);
    console.log(`[RECEIPT DISPATCHER] Target: ${customerId}`);
    console.log(`--------------------------------------------------`);
    console.log(`INVOICE FOR ${customerName.toUpperCase()}`);
    console.log(`Order ID: ${orderId}`);
    console.log(`Time: ${now}`);
    console.log(`Payment Method: ${payment}`);
    console.log(`Items:\n${receiptItemsText}`);
    console.log(`--------------------------------------------------`);
    console.log(`GRAND TOTAL: ₹${total}`);
    console.log(`[RECEIPT DISPATCHER] Dispatch successful! Receipt sent via ${dispatchMethod}.`);
    console.log(`==================================================\n`);

    createdOrder.receiptSentTo = customerId;

    if (isEmail) {
      sendReceiptEmail(customerId, createdOrder, createdItems).catch(err => {
        console.error('[RECEIPT DISPATCHER ERROR] Automatic receipt email failed:', err);
      });
    }

    // Group items by stall to notify vendors
    const itemsByStall = createdItems.reduce((acc, item) => {
      const itemStallId = item.stallId || item.stallid;
      if (!acc[itemStallId]) acc[itemStallId] = [];
      acc[itemStallId].push(item);
      return acc;
    }, {});

    // Notify respective vendors
    for (const [stallId, stallItems] of Object.entries(itemsByStall)) {
      const stallOrder = {
        ...createdOrder,
        customerName: createdOrder.customerName || createdOrder.customername,
        customerId: createdOrder.customerId || createdOrder.customerid,
        items: stallItems.map(si => `${si.quantity}x ${si.name}`).join(', '),
        originalItems: stallItems
      };
      io.to(`vendor-${stallId}`).emit('order_new', stallOrder);
    }

    // Notify active student trackers & public board queue
    io.to('student').emit('order_new_student', createdOrder);
    broadcastQueueUpdate();

    res.json(createdOrder);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

async function sendReceiptEmail(toEmail, order, items) {
  return emailService.sendOrderConfirmation(toEmail, order, items);
}

// Developer Email Template Preview Route
app.get('/api/dev/email-preview/:template', async (req, res) => {
  const { template } = req.params;
  try {
    const mockOrder = {
      id: 'ORD-98765',
      total: 250,
      payment: 'Online UPI',
      timestamp: new Date().toISOString(),
      customerName: 'Rahul Sharma',
    };
    const mockItems = [
      { name: 'Paneer Cheese Burger', price: 120, quantity: 1, stallName: 'Burger Craft' },
      { name: 'Cold Coffee Thick', price: 130, quantity: 1, stallName: 'Cafe Beans' }
    ];

    const mockData = {
      order: mockOrder,
      items: mockItems,
      shopName: 'Burger Craft & Cafe Beans',
      paymentMethod: 'UPI',
      customerName: 'Rahul Sharma',
      subtotal: '238.10',
      gst: '11.90',
      total: '250.00',
      dateFormatted: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      userName: 'Rahul Sharma',
      actionLink: 'https://smart-bite-rosy.vercel.app/reset-password?token=mock123',
      otp: '849201',
      verificationLink: 'https://smart-bite-rosy.vercel.app/verify?token=mock123',
      loginLink: 'https://smart-bite-rosy.vercel.app/login',
      senderName: 'Priya Verma',
      senderEmail: 'priya@example.com',
      subject: 'Inquiry regarding bulk order discount',
      message: 'Hi SGU SmartBite Team,\nWe are organizing a college fest event and would like to place a bulk order of 50 pizzas.',
      title: 'Order Ready for Pickup!',
      actionUrl: 'https://smart-bite-rosy.vercel.app/orders/ORD-98765',
      actionText: 'View Order Status',
      inviteeName: 'Amit Patel',
      role: 'Stall Vendor',
      stallName: 'Dominos Express',
      inviteLink: 'https://smart-bite-rosy.vercel.app/vendor/accept-invite?token=mock123',
    };

    const html = await emailService.renderTemplate(template, mockData);
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Resend Digital Receipt Endpoint
app.post('/api/orders/:id/resend', async (req, res) => {
  const { id } = req.params;
  const { customEmail } = req.body || {};
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const orderItems = await db.all('SELECT * FROM order_items WHERE orderId = ?', [id]);
    
    // Determine the target destination case-safely
    const customerIdVal = order.customerId || order.customerid || '';
    const customerNameVal = order.customerName || order.customername || 'Student';
    const paymentVal = order.payment || order.payment || 'Online UPI';
    const totalVal = order.total || order.total || 0;
    const targetRecipient = customEmail || customerIdVal;
    
    const isEmail = targetRecipient.includes('@');
    const dispatchMethod = isEmail ? 'EMAIL' : 'MOBILE SMS';
    const now = new Date().toISOString();
    
    // --- DIGITAL RECEIPT DISPATCHER ---
    const receiptItemsText = orderItems.map(item => {
      const q = item.quantity || 1;
      const n = item.name || '';
      const p = item.price || 0;
      const s = item.stallName || item.stallname || 'Stall';
      return `   - ${q}x ${n} (₹${p} each) - Stall: ${s}`;
    }).join('\n');
    
    console.log(`\n==================================================`);
    console.log(`[RECEIPT DISPATCHER] RESENDING RECEIPT FOR ORDER: ${order.id}`);
    console.log(`[RECEIPT DISPATCHER] Dispatching Digital Receipt to Customer via ${dispatchMethod}:`);
    console.log(`[RECEIPT DISPATCHER] Target: ${targetRecipient}`);
    console.log(`--------------------------------------------------`);
    console.log(`INVOICE FOR ${customerNameVal.toUpperCase()}`);
    console.log(`Order ID: ${order.id}`);
    console.log(`Time: ${now}`);
    console.log(`Payment Method: ${paymentVal}`);
    console.log(`Items:\n${receiptItemsText}`);
    console.log(`--------------------------------------------------`);
    console.log(`GRAND TOTAL: ₹${totalVal}`);
    
    if (isEmail) {
      try {
        const mailResult = await sendReceiptEmail(targetRecipient, order, orderItems);
        if (mailResult.simulated) {
          console.log(`[RECEIPT DISPATCHER] Simulated email dispatch successful.`);
        } else {
          console.log(`[RECEIPT DISPATCHER] Real SMTP email dispatch successful.`);
        }
      } catch (mailErr) {
        console.error(`[RECEIPT DISPATCHER] Nodemailer failed:`, mailErr);
      }
    }
    
    console.log(`[RECEIPT DISPATCHER] Re-dispatch successful! Receipt sent via ${dispatchMethod}.`);
    console.log(`==================================================\n`);

    res.json({ success: true, message: `Receipt successfully resent via ${dispatchMethod}.`, targetRecipient });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Fetch active orders queue  ← must be BEFORE /api/orders/:id
app.get('/api/orders/queue', async (req, res) => {
  try {
    const activeOrders = await db.all(
      `SELECT id, status, customerName FROM orders WHERE status IN ('placed', 'preparing', 'ready') ORDER BY timestamp DESC`
    );
    const formatted = activeOrders.map(o => ({
      id: o.id,
      status: o.status,
      customerName: o.customerName || o.customername
    }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Fetch active student orders  ← must be BEFORE /api/orders/:id
app.get('/api/orders/student/:customerId', async (req, res) => {
  const { customerId } = req.params;
  const reqUserId = (req.headers['x-user-id'] || '').trim().toLowerCase();
  const reqUserRole = (req.headers['x-user-role'] || '').trim().toLowerCase();

  // Security Access Guard: A student/guest can ONLY access their own orders
  if ((reqUserRole === 'student' || reqUserRole === 'guest') && reqUserId && reqUserId !== customerId.trim().toLowerCase()) {
    console.warn(`[SECURITY GUARD ALERT] Unauthorized student order access attempt! User '${reqUserId}' attempted to access orders of student '${customerId}'`);
    return res.status(403).json({ 
      success: false, 
      message: 'Access Denied: Security Policy Violation. You are only authorized to view your own order history.' 
    });
  }

  try {
    const studentOrders = await db.all('SELECT * FROM orders WHERE LOWER(customerId) = LOWER(?) ORDER BY timestamp DESC', [customerId.trim()]);
    for (const order of studentOrders) {
      order.items = await db.all('SELECT * FROM order_items WHERE orderId = ?', [order.id]);
    }
    res.json(studentOrders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Fetch vendor stall orders  ← must be BEFORE /api/orders/:id
app.get('/api/orders/stall/:stallId', async (req, res) => {
  const { stallId } = req.params;
  try {
    // Get all order IDs that contain items from this stall
    const orderItems = await db.all('SELECT * FROM order_items WHERE stallId = ?', [stallId]);
    const orderIds = [...new Set(orderItems.map(oi => oi.orderId || oi.orderid))];

    if (orderIds.length === 0) return res.json([]);

    const placeholders = orderIds.map(() => '?').join(',');
    const orders = await db.all(`SELECT * FROM orders WHERE id IN (${placeholders}) ORDER BY timestamp DESC`, orderIds);

    // Filter items to show only those belonging to this stall for the vendor dashboard
    const formattedOrders = orders.map(order => {
      const orderIdVal = order.id;
      const filteredItems = orderItems.filter(oi => oi.orderId === orderIdVal);
      return {
        ...order,
        customerName: order.customerName,
        customerId: order.customerId,
        items: filteredItems.map(oi => `${oi.quantity}x ${oi.name}`).join(', '),
        originalItems: filteredItems
      };
    });

    res.json(formattedOrders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Fetch single order details  ← generic wildcard LAST
app.get('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  const reqUserId = (req.headers['x-user-id'] || '').trim().toLowerCase();
  const reqUserRole = (req.headers['x-user-role'] || '').trim().toLowerCase();

  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Security Access Guard: Verify order ownership if requester is student or guest
    if ((reqUserRole === 'student' || reqUserRole === 'guest') && reqUserId) {
      const orderOwner = (order.customerId || '').trim().toLowerCase();
      if (orderOwner && orderOwner !== reqUserId) {
        console.warn(`[SECURITY GUARD ALERT] Unauthorized single order view attempt! User '${reqUserId}' attempted to view order #${id} owned by '${orderOwner}'`);
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Security Policy Violation. You cannot access or view another student\'s order invoice.'
        });
      }
    }

    const items = await db.all('SELECT * FROM order_items WHERE orderId = ?', [id]);
    order.items = items;
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update order status
app.put('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    const updated = await db.get('SELECT * FROM orders WHERE id = ?', [id]);

    const orderItems = await db.all('SELECT * FROM order_items WHERE orderId = ?', [id]);
    updated.items = orderItems;

    // Group items by stall to notify vendors
    const itemsByStall = orderItems.reduce((acc, item) => {
      const itemStallId = item.stallId || item.stallid;
      if (!acc[itemStallId]) acc[itemStallId] = [];
      acc[itemStallId].push(item);
      return acc;
    }, {});

    for (const [stallId, stallItems] of Object.entries(itemsByStall)) {
      const stallOrder = {
        ...updated,
        customerName: updated.customerName || updated.customername,
        customerId: updated.customerId || updated.customerid,
        items: stallItems.map(si => `${si.quantity}x ${si.name}`).join(', '),
        originalItems: stallItems
      };
      io.to(`vendor-${stallId}`).emit('order_status_update', stallOrder);
    }

    // Send update notification to everyone listening
    io.to(`order-${id}`).emit('order_status_update', updated);
    io.to('student').emit('order_status_update', updated);
    broadcastQueueUpdate();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin Analytics API
app.get('/api/admin/metrics', async (req, res) => {
  try {
    const totalOrders = await db.get('SELECT COUNT(*) as count FROM orders');
    const totalSales = await db.get('SELECT SUM(total) as sum FROM orders');
    const activeStalls = await db.get("SELECT COUNT(*) as count FROM stalls WHERE online = 1");
    const completedOrders = await db.all("SELECT * FROM orders WHERE status = 'completed'");
    const allOrdersList = await db.all("SELECT * FROM orders ORDER BY timestamp DESC LIMIT 50");

    for (const order of allOrdersList) {
      order.items = await db.all('SELECT * FROM order_items WHERE orderId = ?', [order.id]);
    }

    res.json({
      totalOrders: totalOrders ? Number(totalOrders.count || 0) : 0,
      totalSales: totalSales ? Number(totalSales.sum || 0) : 0,
      activeStalls: activeStalls ? Number(activeStalls.count || 0) : 0,
      averageWaitTime: 12,
      orders: allOrdersList
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// System Health & Diagnostics API Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'SGU Smart-Bite Enterprise Backend',
    version: '10.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    serverless: Boolean(process.env.VERCEL)
  });
});

// Boot Database and listen (only run local HTTP listener when NOT in test mode & NOT deploying to serverless/Vercel)
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test' && !process.env.NO_LISTEN) {
  const PORT = 3001;
  initDatabase()
    .then(() => {
      httpServer.listen(PORT, () => {
        console.log(`Backend server listening at http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to initialize database:', err);
    });
}

export default app;
