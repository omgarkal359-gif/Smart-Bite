import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';

// Backend components
import { initDatabase, close as closeDb, ping as pingDb } from './db.js';
import { initSmtp } from './utils/email.js';
import logger from './utils/logger.js';

import { db } from './db.js';
import emailService from './services/EmailService.js';

// Route files
import authRoutes from './routes/auth.routes.js';
import stallsRoutes from './routes/stalls.routes.js';
import menuRoutes from './routes/menu.routes.js';
import ordersRoutes from './routes/orders.routes.js';
import adminRoutes from './routes/admin.routes.js';

const DEFAULT_ORIGINS = [
  'https://smart-bite-rosy.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
];
const envOrigins = config.ALLOWED_ORIGINS 
  ? config.ALLOWED_ORIGINS.split(',').map(o => o.trim()) 
  : [];
const ALLOWED_ORIGINS = [...new Set([...DEFAULT_ORIGINS, ...envOrigins])];


const app = express();
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// Set up Socket.io instance on express app object
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PUT'],
    credentials: true
  }
});
app.set('io', io);

// Socket.io connection hook
io.on('connection', (socket) => {
  logger.info(`Client socket connected: ${socket.id}`);

  socket.on('join', (room) => {
    // Validate room namespace strings before joining (Finding 14)
    const isValidRoom = typeof room === 'string' && (
      room === 'student' ||
      room === 'public-board' ||
      room.startsWith('vendor-') ||
      room.startsWith('order-') ||
      room.startsWith('stall-status-') ||
      room.startsWith('stall-menu-')
    );

    if (isValidRoom) {
      socket.join(room);
      logger.info(`Socket ${socket.id} joined room: ${room}`);
    } else {
      logger.warn(`Socket ${socket.id} attempted to join invalid room string: ${room}`);
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Client socket disconnected: ${socket.id}`);
  });
});

// Bootstrap SMTP transporter in background
initSmtp().catch(() => {});

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, message: 'Rate limit exceeded.' }
});

app.use('/api/auth/', authLimiter);
app.use('/api/', generalLimiter);

// Serverless DB initializer middleware
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
      console.error('[DATABASE INIT ERROR]', err);
      return res.status(503).json({ success: false, message: 'Service temporarily unavailable.' });
    }
  }
  next();
});

// Health check endpoint
const getHealthStatus = async (req, res) => {
  try {
    const isDbAlive = await pingDb();
    res.json({
      status: 'UP',
      healthy: isDbAlive,
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: isDbAlive ? 'connected' : 'disconnected'
    });
  } catch (err) {
    res.status(500).json({ status: 'DOWN', error: err.message });
  }
};

app.get('/api/health', getHealthStatus);
app.get('/api/v1/health', getHealthStatus);

// Mount routing files (backward compatible & versioned)
app.use('/api/auth', authRoutes);
app.use('/api/v1/auth', authRoutes);

app.use('/api/stalls', stallsRoutes);
app.use('/api/v1/stalls', stallsRoutes);

app.use('/api/menu', menuRoutes);
app.use('/api/v1/menu', menuRoutes);

app.use('/api/orders', ordersRoutes);
app.use('/api/v1/orders', ordersRoutes);

app.use('/api/admin', adminRoutes);
app.use('/api/v1/admin', adminRoutes);

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error('[UNHANDLED EXCEPTION]', err, { url: req.url, method: req.method });
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'An internal error occurred.'
  });
});

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

// Graceful Shutdown Sequence
async function shutdown(signal) {
  logger.info(`[LIFECYCLE] Received ${signal}. Starting graceful shutdown sequence...`);
  
  // Close the socket.io and server connections
  io.close(() => {
    logger.info('[LIFECYCLE] Socket.io server connections closed.');
  });

  httpServer.close(async () => {
    logger.info('[LIFECYCLE] HTTP server stopped accepting new requests.');
    try {
      await closeDb();
      logger.info('[LIFECYCLE] Database connections cleaned up.');
      process.exit(0);
    } catch (dbErr) {
      logger.error('[LIFECYCLE ERROR] Database connection shutdown failed:', dbErr);
      process.exit(1);
    }
  });

  // Enforce termination timeout (10 seconds)
  setTimeout(() => {
    logger.error('[LIFECYCLE ERROR] Forced shutdown timed out. Exiting immediately.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Local Boot listener
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test' && !process.env.NO_LISTEN) {
  const PORT = process.env.PORT || 3001;
  initDatabase()
    .then(() => {
      httpServer.listen(PORT, () => {
        logger.info(`Backend server listening at http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      logger.error('Failed to initialize database on startup:', err);
    });
}

export default app;
