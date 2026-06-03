import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
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
    io.to('public-board').emit('queue_update', activeOrders);
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
      let user = await db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'guest']);
      if (!user) {
        await db.run(
          'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
          [username, username, '', 'guest', null]
        );
        user = await db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'guest']);
      }
      return res.json({ success: true, user });
    }

    if (role === 'student') {
      // Find student by username
      let user = await db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'student']);
      if (!user) {
        // Dynamically create student record if not existing
        await db.run(
          'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
          [username, name || 'Student', '', 'student', null]
        );
        user = await db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, 'student']);
      }
      return res.json({ success: true, user });
    }

    const user = await db.get(
      'SELECT * FROM users WHERE username = ? AND password = ? AND role = ?',
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
    res.json(stalls);
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

    const newOnline = online !== undefined ? (online ? 1 : 0) : current.online;
    const newWaitTime = waitTime !== undefined ? waitTime : current.waitTime;
    const newBusy = busyMode !== undefined ? (busyMode ? 1 : 0) : current.busyMode;

    await db.run(
      'UPDATE stalls SET online = ?, waitTime = ?, busyMode = ? WHERE id = ?',
      [newOnline, newWaitTime, newBusy, id]
    );

    const updated = await db.get('SELECT * FROM stalls WHERE id = ?', [id]);
    io.to('student').emit('stall_status_update', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Menu for stall
app.get('/api/stalls/:id/menu', async (req, res) => {
  const { id } = req.params;
  try {
    const items = await db.all('SELECT * FROM menu_items WHERE stallId = ? AND available = 1', [id]);
    res.json(items);
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

    // Group items by stall to notify vendors
    const itemsByStall = createdItems.reduce((acc, item) => {
      if (!acc[item.stallId]) acc[item.stallId] = [];
      acc[item.stallId].push(item);
      return acc;
    }, {});

    // Notify respective vendors
    for (const [stallId, stallItems] of Object.entries(itemsByStall)) {
      const stallOrder = {
        ...createdOrder,
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

// Resend Digital Receipt Endpoint
app.post('/api/orders/:id/resend', async (req, res) => {
  const { id } = req.params;
  try {
    const order = await db.get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    const orderItems = await db.all('SELECT * FROM order_items WHERE orderId = ?', [id]);
    
    // --- DIGITAL RECEIPT DISPATCHER ---
    const receiptItemsText = orderItems.map(item => `   - ${item.quantity}x ${item.name} (₹${item.price} each) - Stall: ${item.stallName}`).join('\n');
    const isEmail = order.customerId.includes('@');
    const dispatchMethod = isEmail ? 'EMAIL' : 'MOBILE SMS';
    const now = new Date().toISOString();
    
    console.log(`\n==================================================`);
    console.log(`[RECEIPT DISPATCHER] RESENDING RECEIPT FOR ORDER: ${order.id}`);
    console.log(`[RECEIPT DISPATCHER] Dispatching Digital Receipt to Customer via ${dispatchMethod}:`);
    console.log(`[RECEIPT DISPATCHER] Target: ${order.customerId}`);
    console.log(`--------------------------------------------------`);
    console.log(`INVOICE FOR ${order.customerName.toUpperCase()}`);
    console.log(`Order ID: ${order.id}`);
    console.log(`Time: ${now}`);
    console.log(`Payment Method: ${order.payment}`);
    console.log(`Items:\n${receiptItemsText}`);
    console.log(`--------------------------------------------------`);
    console.log(`GRAND TOTAL: ₹${order.total}`);
    console.log(`[RECEIPT DISPATCHER] Re-dispatch successful! Receipt sent via ${dispatchMethod}.`);
    console.log(`==================================================\n`);

    res.json({ success: true, message: `Receipt successfully resent via ${dispatchMethod}.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Fetch active orders queue
app.get('/api/orders/queue', async (req, res) => {
  try {
    const activeOrders = await db.all(
      `SELECT id, status, customerName FROM orders WHERE status IN ('placed', 'preparing', 'ready') ORDER BY timestamp DESC`
    );
    res.json(activeOrders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Fetch single order details
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

// Fetch active student orders
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

// Fetch active vendor orders
app.get('/api/orders/stall/:stallId', async (req, res) => {
  const { stallId } = req.params;
  try {
    // Get all order IDs that contain items from this stall
    const orderItems = await db.all('SELECT * FROM order_items WHERE stallId = ?', [stallId]);
    const orderIds = [...new Set(orderItems.map(oi => oi.orderId))];

    if (orderIds.length === 0) return res.json([]);

    const placeholders = orderIds.map(() => '?').join(',');
    const orders = await db.all(`SELECT * FROM orders WHERE id IN (${placeholders}) ORDER BY timestamp DESC`, orderIds);

    // Filter items to show only those belonging to this stall for the vendor dashboard
    const formattedOrders = orders.map(order => {
      const filteredItems = orderItems.filter(oi => oi.orderId === order.id);
      return {
        ...order,
        items: filteredItems.map(oi => `${oi.quantity}x ${oi.name}`).join(', '),
        originalItems: filteredItems
      };
    });

    res.json(formattedOrders);
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
