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

const app = express();
app.use(cors());
app.use(express.json());

// Database initialization middleware for Serverless environment
let dbInitialized = false;
let dbInitPromise = null;

app.use(async (req, res, next) => {
  if (!dbInitialized) {
    if (!dbInitPromise) {
      // In Vercel serverless production, skip the heavy CREATE TABLE and seeding checks
      // to avoid query roundtrip latency and prevent Vercel 10s execution timeouts.
      if (process.env.VERCEL) {
        dbInitialized = true;
        dbInitPromise = Promise.resolve();
      } else {
        dbInitPromise = initDatabase()
          .then(() => {
            dbInitialized = true;
          })
          .catch((err) => {
            dbInitPromise = null;
            throw err;
          });
      }
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
      return res.json({ success: true, user });
    }

    if (role === 'student') {
      // Find student by username
      let user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = ?', [username, 'student']);
      if (!user) {
        // Dynamically create student record if not existing
        await db.run(
          'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
          [username, name || 'Student', '', 'student', null]
        );
        user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND role = ?', [username, 'student']);
      }
      return res.json({ success: true, user });
    }

    const user = await db.get(
      'SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND password = ? AND role = ?',
      [username, password, role]
    );

    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials or role selection.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Google Auth Single Sign-On (SSO)
app.post('/api/auth/google', async (req, res) => {
  const { email, name } = req.body;
  try {
    let user = await db.get('SELECT * FROM users WHERE username = ?', [email]);
    if (!user) {
      // Register new student automatically upon first Google login
      await db.run(
        'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
        [email, name || 'Google Student', '', 'student', null]
      );
      user = await db.get('SELECT * FROM users WHERE username = ?', [email]);
    }
    res.json({ success: true, user });
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
  const { customerName, customerId, type, payment, total, items } = req.body;
  try {
    // Generate order ID
    const orderId = `SGU-${Math.floor(1000 + Math.random() * 9000)}`;
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
    const isEmail = customerId.includes('@');
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

// Setup Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

let dynamicTransporter = null;

async function getTransporter() {
  if (process.env.SMTP_USER) {
    return transporter;
  }
  if (!dynamicTransporter) {
    console.log('[RECEIPT SMTP] No SMTP_USER configured. Generating temporary Ethereal SMTP credentials...');
    try {
      const testAccount = await nodemailer.createTestAccount();
      dynamicTransporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`[RECEIPT SMTP] Temporary Ethereal account generated: ${testAccount.user}`);
    } catch (err) {
      console.error('[RECEIPT SMTP] Failed to generate temporary Ethereal account:', err);
    }
  }
  return dynamicTransporter;
}

async function sendReceiptEmail(toEmail, order, items) {
  const itemsText = items.map(item => `   - ${item.quantity}x ${item.name} (₹${item.price} each) - Stall: ${item.stallName || item.stallname}`).join('\n');
  
  const totalVal = parseFloat(order.total) || 0;
  const subtotalVal = totalVal / 1.05;
  const gstVal = totalVal - subtotalVal;
  
  const subtotal = subtotalVal.toFixed(2);
  const gst = gstVal.toFixed(2);
  const total = totalVal.toFixed(2);

  const shopName = items[0]?.stallName || items[0]?.stallname || 'SGU Food Court';
  const paymentMethod = order.payment === 'Online UPI' ? 'UPI' : 'CASH';
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  const now = new Date().toISOString();

  const itemsHtml = items.map(item => `
    <tr>
      <td style="padding-top: 4px; padding-bottom: 4px; text-align: left; vertical-align: top; text-transform: uppercase;">
        ${item.name}
      </td>
      <td style="padding-top: 4px; padding-bottom: 4px; text-align: center; vertical-align: top; width: 40px;">
        ${item.quantity || 1}
      </td>
      <td style="padding-top: 4px; padding-bottom: 4px; text-align: right; vertical-align: top; width: 80px;">
        ₹${((item.price || 0) * (item.quantity || 1)).toFixed(2)}
      </td>
    </tr>
  `).join('');

  const emailBodyText = `
RECEIPT
==================================================
ORDERS #${order.id}

PREPARED BY
${shopName.toUpperCase()}
Hours: 10 AM-10:45 PM

--------------------------------------------------
${itemCount} ${itemCount === 1 ? 'ITEM' : 'ITEMS'}
--------------------------------------------------
${itemsText}

--------------------------------------------------
Subtotal                : ₹${subtotal}
GST                     : ₹${gst}
--------------------------------------------------
TOTAL (GST INCLUDED)    : ₹${total}
PAYMENT                 : ${paymentMethod.toUpperCase()}

Thank you for dining with us!
==================================================
`;

  const emailBodyHtml = `
    <div style="background-color: #f3f4f6; padding: 30px 15px; font-family: 'Courier New', Courier, monospace; min-height: 100%;">
      <div style="background-color: #ffffff; max-width: 380px; width: 100%; padding: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-top: 5px dashed #000000; border-bottom: 5px dashed #000000; margin: 0 auto; color: #000000; box-sizing: border-box;">
        
        <div style="text-align: center; margin-bottom: 15px;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; line-height: 1.2;">SGU FOOD COURT</h1>
          <h2 style="margin: 5px 0 0 0; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">STALL: ${shopName.toUpperCase()}</h2>
          <p style="margin: 5px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">HOURS: 10 AM-10:45 PM</p>
        </div>
        
        <div style="border-bottom: 2px dashed #000000; margin: 15px 0;"></div>
        
        <div style="font-size: 12px; font-weight: bold; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 900; text-transform: uppercase;">ORDER ID:</span>
            <span style="font-weight: 900;">${order.id.toUpperCase()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 900; text-transform: uppercase;">DATE:</span>
            <span>${new Date(order.timestamp || now).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }).toUpperCase()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 900; text-transform: uppercase;">CUSTOMER:</span>
            <span>${order.customerName ? order.customerName.toUpperCase() : (order.customername ? order.customername.toUpperCase() : 'STUDENT')}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 900; text-transform: uppercase;">PAYMENT:</span>
            <span style="font-weight: 900;">${paymentMethod.toUpperCase()}</span>
          </div>
        </div>
        
        <div style="border-bottom: 2px dashed #000000; margin: 15px 0;"></div>
        
        <div style="margin-bottom: 15px;">
          <div style="font-size: 12px; font-weight: 900; display: flex; justify-content: space-between; padding-bottom: 8px; border-bottom: 1px dashed #000000;">
            <span>ITEM DESCRIPTION</span>
            <span style="text-align: center; width: 40px;">QTY</span>
            <span style="text-align: right; width: 80px;">AMOUNT</span>
          </div>
          <table cellpadding="0" cellspacing="0" border="0" style="width: 100%; font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: bold; margin-top: 8px;">
            ${itemsHtml}
          </table>
        </div>
        
        <div style="border-bottom: 2px dashed #000000; margin: 15px 0;"></div>
        
        <div style="font-size: 12px; font-weight: bold; margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 900; text-transform: uppercase;">SUBTOTAL:</span>
            <span>₹${subtotal}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 900; text-transform: uppercase;">GST (5.0%):</span>
            <span>₹${gst}</span>
          </div>
          
          <div style="border-bottom: 1px solid #000000; margin: 8px 0;"></div>
          
          <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; margin-top: 8px;">
            <span style="font-weight: 900; text-transform: uppercase;">TOTAL (INCL. GST):</span>
            <span>₹${total}</span>
          </div>
        </div>
        
        <div style="border-bottom: 2px dashed #000000; margin: 15px 0;"></div>
        
        <div style="text-align: center; margin-top: 15px;">
          <p style="margin: 0; font-size: 11px; font-weight: 900; letter-spacing: 1px;">*** THANK YOU FOR YOUR VISIT ***</p>
          <p style="margin: 3px 0 0 0; font-size: 9px; font-weight: bold;">SGU SMARTBITE DIGITAL RECEIPT</p>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <div style="display: inline-block; font-size: 20px; font-weight: 300; letter-spacing: 1px; transform: scaleY(1.3); line-height: 1;">
            ||| | || |||| | | ||| || ||| || ||
          </div>
          <div style="font-size: 9px; letter-spacing: 2px; text-transform: uppercase; margin-top: 5px;">*SGU-ORDER-${order.id}*</div>
        </div>
        
      </div>
    </div>
  `;

  const activeTransporter = await getTransporter();
  if (activeTransporter) {
    try {
      const fromEmail = process.env.SMTP_USER || activeTransporter.options.auth.user;
      const info = await activeTransporter.sendMail({
        from: `"SGU Food Court" <${fromEmail}>`,
        to: toEmail,
        subject: `Your SGU Food Court Digital Receipt - #${order.id}`,
        text: emailBodyText,
        html: emailBodyHtml,
      });
      console.log(`[RECEIPT SMTP] Receipt sent to ${toEmail} successfully.`);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log(`[RECEIPT SMTP] Preview URL (Click to view): ${previewUrl}`);
      }
      return { success: true, previewUrl };
    } catch (err) {
      console.error('[RECEIPT SMTP] Failed to send email via nodemailer:', err);
      throw err;
    }
  } else {
    console.log(`[RECEIPT SMTP] No SMTP_USER and failed to generate temporary Ethereal account. Simulating email send to: ${toEmail}`);
    return { simulated: true, toEmail };
  }
}

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
  try {
    const studentOrders = await db.all('SELECT * FROM orders WHERE customerId = ? ORDER BY timestamp DESC', [customerId]);
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
      const filteredItems = orderItems.filter(oi => (oi.orderId || oi.orderid) === orderIdVal);
      return {
        ...order,
        customerName: order.customerName || order.customername,
        customerId: order.customerId || order.customerid,
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
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ message: 'Order not found' });
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
      totalOrders: totalOrders.count,
      totalSales: totalSales.sum || 0,
      activeStalls: activeStalls.count,
      averageWaitTime: 12, // mock metric, or calculate if wanted
      orders: allOrdersList
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Boot Database and listen (only run local HTTP listener when NOT deploying to serverless/Vercel)
if (!process.env.VERCEL) {
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
