import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { config } from './config.js';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = config.SUPABASE_URL;
const supabaseKey = config.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Connection configuration & variables
const connectionString = config.DATABASE_URL;
let pool = null;
if (connectionString && !connectionString.includes('[YOUR-PASSWORD]')) {
  pool = new Pool({
    connectionString,
    idleTimeoutMillis: 5000, // Close idle connections after 5 seconds
    max: 10 // Maximum pool size
  });
}

let isPgActive = false;
let isSqliteActive = false;
let sqliteDb = null;

function convertSql(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

export const db = {
  async run(sql, params = []) {
    if (isPgActive) {
      let pgSql = convertSql(sql);
      if (pgSql.trim().toUpperCase().startsWith('INSERT ') && !pgSql.trim().toUpperCase().includes('RETURNING')) {
        pgSql = `${pgSql} RETURNING id`;
      }
      const res = await pool.query(pgSql, params);
      return { id: res.rows[0]?.id, changes: res.rowCount };
    } else if (isSqliteActive && sqliteDb) {
      return new Promise((resolve, reject) => {
        sqliteDb.run(sql, params, function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, changes: this.changes });
        });
      });
    } else {
      // Pure JS Fallback Engine
      return executeMemRun(sql, params);
    }
  },

  async all(sql, params = []) {
    if (isPgActive) {
      const pgSql = convertSql(sql);
      const res = await pool.query(pgSql, params);
      return res.rows;
    } else if (isSqliteActive && sqliteDb) {
      return new Promise((resolve, reject) => {
        sqliteDb.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    } else {
      return executeMemAll(sql, params);
    }
  },

  async get(sql, params = []) {
    if (isPgActive) {
      const pgSql = convertSql(sql);
      const res = await pool.query(pgSql, params);
      return res.rows[0] || null;
    } else if (isSqliteActive && sqliteDb) {
      return new Promise((resolve, reject) => {
        sqliteDb.get(sql, params, (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      });
    } else {
      const rows = executeMemAll(sql, params);
      return rows[0] || null;
    }
  },

  async exec(sql) {
    if (isPgActive) {
      const pgSql = convertSql(sql);
      await pool.query(pgSql);
    } else if (isSqliteActive && sqliteDb) {
      return new Promise((resolve, reject) => {
        sqliteDb.exec(sql, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    // For pure JS memory store, schema initialization is dynamic
  },

  async transaction(callback) {
    if (isPgActive && pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const tx = {
          async run(sql, params = []) {
            let pgSql = convertSql(sql);
            if (pgSql.trim().toUpperCase().startsWith('INSERT ') && !pgSql.trim().toUpperCase().includes('RETURNING')) {
              pgSql = `${pgSql} RETURNING id`;
            }
            const res = await client.query(pgSql, params);
            return { id: res.rows[0]?.id || null, changes: res.rowCount };
          },
          async all(sql, params = []) {
            const pgSql = convertSql(sql);
            const res = await client.query(pgSql, params);
            return res.rows;
          },
          async get(sql, params = []) {
            const pgSql = convertSql(sql);
            const res = await client.query(pgSql, params);
            return res.rows[0] || null;
          },
          async exec(sql) {
            const pgSql = convertSql(sql);
            await client.query(pgSql);
          }
        };
        const result = await callback(tx);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else if (isSqliteActive && sqliteDb) {
      return new Promise((resolve, reject) => {
        sqliteDb.serialize(async () => {
          try {
            await new Promise((res, rej) => {
              sqliteDb.run('BEGIN TRANSACTION', (err) => {
                if (err) rej(err);
                else res();
              });
            });
            const result = await callback(db);
            await new Promise((res, rej) => {
              sqliteDb.run('COMMIT', (err) => {
                if (err) rej(err);
                else res();
              });
            });
            resolve(result);
          } catch (err) {
            sqliteDb.run('ROLLBACK', () => {});
            reject(err);
          }
        });
      });
    } else {
      const backup = JSON.parse(JSON.stringify(memStore));
      try {
        const result = await callback(db);
        return result;
      } catch (err) {
        Object.assign(memStore, backup);
        throw err;
      }
    }
  }
};

// Pure JS Memory Store Query Handlers
function executeMemRun(sql, params) {
  const cleanSql = sql.trim();
  const upper = cleanSql.toUpperCase();

  if (upper.startsWith('INSERT INTO USERS')) {
    const [username, name, password, role, shopId] = params;
    const existing = memStore.users.find(u => u.username.toLowerCase() === (username || '').toLowerCase());
    if (existing) {
      existing.name = name;
      existing.password = password;
      existing.role = role;
      existing.shopId = shopId;
      return { id: existing.id, changes: 1 };
    }
    const id = memStore.nextId.users++;
    const newUser = { id, username, name, password, role, shopId };
    memStore.users.push(newUser);
    return { id, changes: 1 };
  }

  if (upper.startsWith('UPDATE USERS SET PASSWORD')) {
    const [password, userId] = params;
    const user = memStore.users.find(u => u.id === userId);
    if (user) user.password = password;
    return { id: userId, changes: user ? 1 : 0 };
  }

  if (upper.startsWith('INSERT INTO STALLS')) {
    const [id, name, category, online, busyMode, waitTime, rating, img, logo] = params;
    const existing = memStore.stalls.find(s => s.id === id);
    const newStall = { id, name, category, online: online ? 1 : 0, busyMode: busyMode ? 1 : 0, waitTime: waitTime || 0, rating: rating || 4.5, img, logo };
    if (existing) Object.assign(existing, newStall);
    else memStore.stalls.push(newStall);
    return { id, changes: 1 };
  }

  if (upper.startsWith('UPDATE STALLS SET ONLINE')) {
    const [online, waitTime, busyMode, id] = params;
    const stall = memStore.stalls.find(s => s.id === id);
    if (stall) {
      stall.online = online;
      stall.waitTime = waitTime;
      stall.busyMode = busyMode;
    }
    return { id, changes: stall ? 1 : 0 };
  }

  if (upper.startsWith('INSERT INTO MENU_ITEMS')) {
    const [stallId, name, price, isVeg, category, stock, available, img] = params;
    const id = memStore.nextId.menu_items++;
    const newItem = { id, stallId, name, price, isVeg: isVeg ? 1 : 0, category, stock: stock || 20, available: available !== undefined ? available : 1, img: img || null };
    memStore.menu_items.push(newItem);
    return { id, changes: 1 };
  }

  if (upper.startsWith('UPDATE MENU_ITEMS SET STOCK')) {
    const [stock, price, available, name, category, itemId] = params;
    const item = memStore.menu_items.find(i => i.id == itemId);
    if (item) {
      item.stock = stock;
      item.price = price;
      item.available = available;
      item.name = name;
      item.category = category;
    }
    return { id: itemId, changes: item ? 1 : 0 };
  }

  if (upper.startsWith('UPDATE MENU_ITEMS SET AVAILABLE')) {
    const [available, itemId] = params;
    const item = memStore.menu_items.find(i => i.id == itemId);
    if (item) item.available = available ? 1 : 0;
    return { id: itemId, changes: item ? 1 : 0 };
  }

  if (upper.startsWith('INSERT INTO ORDERS ')) {
    const [id, customerName, customerId, type, payment, status, total, time, timestamp] = params;
    const newOrder = { id, customerName, customerId, type, payment, status, total, time, timestamp };
    memStore.orders.push(newOrder);
    return { id, changes: 1 };
  }

  if (upper.startsWith('INSERT INTO ORDER_ITEMS')) {
    const [orderId, itemId, name, price, quantity, stallId, stallName] = params;
    const id = memStore.nextId.order_items++;
    const newItem = { id, orderId, itemId, name, price, quantity, stallId, stallName };
    memStore.order_items.push(newItem);
    return { id, changes: 1 };
  }

  if (upper.startsWith('UPDATE ORDERS SET STATUS')) {
    const [status, id] = params;
    const order = memStore.orders.find(o => o.id === id);
    if (order) order.status = status;
    return { id, changes: order ? 1 : 0 };
  }

  return { id: 1, changes: 0 };
}

function executeMemAll(sql, params) {
  const upper = sql.trim().toUpperCase();

  if (upper.includes('COUNT(*) AS COUNT FROM USERS')) {
    return [{ count: memStore.users.length }];
  }

  if (upper.includes('COUNT(*) AS COUNT FROM STALLS')) {
    return [{ count: memStore.stalls.length }];
  }

  if (upper.includes('COUNT(*) AS COUNT FROM MENU_ITEMS')) {
    return [{ count: memStore.menu_items.length }];
  }

  if (upper.includes('FROM USERS WHERE LOWER(USERNAME) = LOWER(?) AND ROLE = ?')) {
    const [username, role] = params;
    const match = memStore.users.find(u => u.username.toLowerCase() === (username || '').toLowerCase() && u.role === role);
    return match ? [match] : [];
  }

  if (upper.includes('FROM USERS WHERE USERNAME = ? AND ROLE = ?')) {
    const [username, role] = params;
    const match = memStore.users.find(u => u.username === username && u.role === role);
    return match ? [match] : [];
  }

  if (upper.includes('FROM USERS WHERE LOWER(USERNAME) = LOWER(?) AND PASSWORD = ? AND ROLE = ?')) {
    const [username, password, role] = params;
    const match = memStore.users.find(u => u.username.toLowerCase() === (username || '').toLowerCase() && u.password === password && u.role === role);
    return match ? [match] : [];
  }

  if (upper.includes('FROM USERS WHERE LOWER(USERNAME) = LOWER(?) AND PASSWORD = ?')) {
    const [username, password] = params;
    const match = memStore.users.find(u => u.username.toLowerCase() === (username || '').toLowerCase() && u.password === password);
    return match ? [match] : [];
  }

  if (upper.includes('FROM USERS WHERE LOWER(USERNAME) = LOWER(?)')) {
    const [username] = params;
    const match = memStore.users.find(u => u.username.toLowerCase() === (username || '').toLowerCase());
    return match ? [match] : [];
  }

  if (upper.includes('FROM USERS WHERE USERNAME = ?')) {
    const [username] = params;
    const match = memStore.users.find(u => u.username === username);
    return match ? [match] : [];
  }

  if (upper.includes('FROM STALLS WHERE ID = ?')) {
    const [id] = params;
    const match = memStore.stalls.find(s => s.id === id);
    return match ? [match] : [];
  }

  if (upper.includes('FROM STALLS')) {
    return memStore.stalls;
  }

  if (upper.includes('FROM MENU_ITEMS WHERE STALLID = ? AND AVAILABLE = 1')) {
    const [stallId] = params;
    return memStore.menu_items.filter(i => i.stallId === stallId && i.available === 1);
  }

  if (upper.includes('FROM MENU_ITEMS WHERE ID = ?')) {
    const [id] = params;
    const match = memStore.menu_items.find(i => i.id == id);
    return match ? [match] : [];
  }

  if (upper.includes('FROM ORDERS WHERE STATUS IN')) {
    return memStore.orders.filter(o => ['placed', 'preparing', 'ready', 'pending_cash'].includes(o.status));
  }

  if (upper.includes('FROM ORDERS WHERE CUSTOMERID = ?')) {
    const [customerId] = params;
    return memStore.orders.filter(o => o.customerId === customerId);
  }

  if (upper.includes('FROM ORDERS WHERE ID = ?')) {
    const [id] = params;
    const match = memStore.orders.find(o => o.id === id);
    return match ? [match] : [];
  }

  if (upper.includes('FROM ORDER_ITEMS WHERE STALLID = ?')) {
    const [stallId] = params;
    return memStore.order_items.filter(i => i.stallId === stallId);
  }

  if (upper.includes('FROM ORDER_ITEMS WHERE ORDERID = ?')) {
    const [orderId] = params;
    return memStore.order_items.filter(i => i.orderId === orderId);
  }

  if (upper.includes('FROM ORDERS WHERE STATUS = \'COMPLETED\'')) {
    return memStore.orders.filter(o => o.status === 'completed');
  }

  if (upper.includes('FROM ORDERS')) {
    return memStore.orders;
  }

  return [];
}

export async function initDatabase() {
  // 1. Test PostgreSQL connection
  if (connectionString && !connectionString.includes('[YOUR-PASSWORD]') && pool) {
    let client;
    try {
      client = await pool.connect();
      await client.query('SELECT 1');
      isPgActive = true;
      console.log('[DATABASE] Connected to PostgreSQL database.');
    } catch (err) {
      isPgActive = false;
      console.warn('[DATABASE WARNING] PostgreSQL connection failed (' + err.message + '). Fallback to local engine.');
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Critical Database Error: PostgreSQL connection failed in production. Details: ${err.message}`);
      }
    } finally {
      if (client) {
        client.release();
      }
    }
  } else {
    isPgActive = false;
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Critical Database Error: PostgreSQL connection string (DATABASE_URL) is missing or unconfigured in production.');
    }
  }

  // 2. Try SQLite if PostgreSQL is not active
  if (!isPgActive && sqlite3) {
    try {
      if (!sqliteDb) {
        const dbPath = process.env.VERCEL ? '/tmp/database.sqlite' : join(__dirname, 'database.sqlite');
        sqliteDb = new sqlite3.Database(dbPath);
      }
      isSqliteActive = true;
    } catch (e) {
      isSqliteActive = false;
    }
  }

  const idType = isPgActive ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id ${idType},
      username TEXT UNIQUE,
      name TEXT,
      password TEXT,
      role TEXT,
      shopId TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS stalls (
      id TEXT PRIMARY KEY,
      name TEXT,
      category TEXT,
      online INTEGER,
      busyMode INTEGER,
      waitTime INTEGER,
      rating REAL,
      img TEXT,
      logo TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id ${idType},
      stallId TEXT,
      name TEXT,
      price REAL,
      isVeg INTEGER,
      category TEXT,
      stock INTEGER,
      img TEXT,
      available INTEGER DEFAULT 1,
      FOREIGN KEY (stallId) REFERENCES stalls(id) ON DELETE CASCADE
    );
  `);

  if (isPgActive) {
    await db.exec('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS img TEXT;');
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customerName TEXT,
      customerId TEXT,
      type TEXT,
      payment TEXT,
      status TEXT,
      total REAL,
      time TEXT,
      timestamp TEXT
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id ${idType},
      orderId TEXT,
      itemId INTEGER,
      name TEXT,
      price REAL,
      quantity INTEGER,
      stallId TEXT,
      stallName TEXT,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (stallId) REFERENCES stalls(id) ON DELETE SET NULL
    );
  `);

  // Create indices to optimize query performance (Finding 9)
  await db.exec('CREATE INDEX IF NOT EXISTS idx_menu_items_stall_id ON menu_items (stallId);');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (orderId);');
  await db.exec('CREATE INDEX IF NOT EXISTS idx_order_items_stall_id ON order_items (stallId);');

  // Seed Users if empty
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (!userCount || parseInt(userCount.count, 10) === 0) {
    await db.run(
      'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
      ['student@sgu.edu', 'Satej', 'password', 'student', null]
    );
    await db.run(
      'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
      ['9876543210', 'Guest Satej', '', 'guest', null]
    );
    await db.run(
      'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
      ['admin@sgu.edu', 'Administrator', 'admin123', 'admin', null]
    );

    // Add stall owners
    const stallIds = [
      'mangales-snacks',
      'tea-coffee',
      'rohit-vadewale',
      'oodles-of-noodles',
      'narayana',
      'cool-cravings'
    ];
    for (const sid of stallIds) {
      await db.run(
        'INSERT INTO users (username, name, password, role, shopId) VALUES (?, ?, ?, ?, ?)',
        [sid, `${sid.replace('-', ' ')} Owner`, '000000000', 'owner', sid]
      );
    }
  }

  // Seed Stalls if empty
  const stallCount = await db.get('SELECT COUNT(*) as count FROM stalls');
  if (!stallCount || parseInt(stallCount.count, 10) === 0) {
    const stallsData = [
      { id: 'mangales-snacks', name: 'Southern Delight(Mangale Snacks)', category: 'The Perfect BITE, Every Time...', online: 1, busyMode: 0, waitTime: 0, rating: 4.6, logo: '🥘', img: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80' },
      { id: 'tea-coffee', name: 'Tea & Coffee', category: 'Fresh brews, every cup', online: 1, busyMode: 0, waitTime: 0, rating: 4.3, logo: '☕', img: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80' },
      { id: 'rohit-vadewale', name: 'Rohit Vadewale', category: 'Rohit Wadewale by Poonam Vijay & Co.', online: 1, busyMode: 0, waitTime: 0, rating: 4.1, logo: '🥟', img: 'https://images.unsplash.com/photo-1567337710282-00832b415979?auto=format&fit=crop&w=400&q=80' },
      { id: 'oodles-of-noodles', name: 'Oodles of Noodles', category: 'Self Service – Chinese & Indo-Chinese', online: 1, busyMode: 0, waitTime: 0, rating: 4.4, logo: '🍜', img: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80' },
      { id: 'narayana', name: 'Narayana', category: 'South Indian Special', online: 1, busyMode: 0, waitTime: 0, rating: 4.5, logo: '🥞', img: 'https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=400&q=80' },
      { id: 'cool-cravings', name: 'Cool Cravings', category: 'Shakes, Mojitos & Cold Coffees', online: 1, busyMode: 0, waitTime: 0, rating: 4.3, logo: '🥤', img: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80' }
    ];

    for (const s of stallsData) {
      await db.run(
        'INSERT INTO stalls (id, name, category, online, busyMode, waitTime, rating, img, logo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [s.id, s.name, s.category, s.online, s.busyMode, s.waitTime, s.rating, s.img, s.logo]
      );
    }
  }

  // Seed Menu Items if empty
  const menuCount = await db.get('SELECT COUNT(*) as count FROM menu_items');
  if (!menuCount || parseInt(menuCount.count, 10) === 0) {
    const itemsData = [
      // mangales-snacks
      { stallId: 'mangales-snacks', name: 'Dahi Thalipeeth', price: 50, isVeg: 1, category: 'Thalipeeth', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Schezwan Thalipeeth', price: 60, isVeg: 1, category: 'Thalipeeth', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Paneer Thalipeeth', price: 70, isVeg: 1, category: 'Thalipeeth', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Cheese Thalipeeth', price: 80, isVeg: 1, category: 'Thalipeeth', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Cheese Paneer Thalipeeth', price: 90, isVeg: 1, category: 'Thalipeeth', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Mozzarella Cheese Thalipeeth', price: 120, isVeg: 1, category: 'Thalipeeth', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Misal', price: 50, isVeg: 1, category: 'Misal', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Dahi Misal', price: 60, isVeg: 1, category: 'Misal', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Cheese Misal', price: 70, isVeg: 1, category: 'Misal', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Extra Bread', price: 10, isVeg: 1, category: 'Misal', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Jumbo Misal', price: 100, isVeg: 1, category: 'Misal', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Masala Rice', price: 40, isVeg: 1, category: 'Rice', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Butter Veg Pulav', price: 60, isVeg: 1, category: 'Rice', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Soya Butter Pulav', price: 70, isVeg: 1, category: 'Rice', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Soya Paneer Pulav', price: 80, isVeg: 1, category: 'Rice', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Paneer Butter Pulav', price: 80, isVeg: 1, category: 'Rice', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Cheese Butter Pulav', price: 90, isVeg: 1, category: 'Rice', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Cheese Paneer Pulav', price: 90, isVeg: 1, category: 'Rice', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Ghee Daal Khichadi', price: 70, isVeg: 1, category: 'Rice', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Masala Dal Khichdi', price: 100, isVeg: 1, category: 'Rice', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Veg Wraps', price: 40, isVeg: 1, category: 'Veg Wraps', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Mayo Veg Wraps', price: 50, isVeg: 1, category: 'Veg Wraps', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Lays Veg Wraps', price: 60, isVeg: 1, category: 'Veg Wraps', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Cheese Veg Wraps', price: 60, isVeg: 1, category: 'Veg Wraps', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Cheese Veg Wraps (Special)', price: 70, isVeg: 1, category: 'Veg Wraps', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Paneer Tikka Veg Wraps', price: 80, isVeg: 1, category: 'Veg Wraps', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Cheesy Paneer Veg Wraps', price: 80, isVeg: 1, category: 'Veg Wraps', stock: 20 },
      { stallId: 'mangales-snacks', name: 'Mozzarella Cheese Wrap', price: 90, isVeg: 1, category: 'Veg Wraps', stock: 20 },

      // tea-coffee
      { stallId: 'tea-coffee', name: 'Gulacha Basundi Tea', price: 10, isVeg: 1, category: "Tea's", stock: 20 },
      { stallId: 'tea-coffee', name: 'Black Tea', price: 15, isVeg: 1, category: "Tea's", stock: 20 },
      { stallId: 'tea-coffee', name: 'Jumbo Tea', price: 20, isVeg: 1, category: "Tea's", stock: 20 },
      { stallId: 'tea-coffee', name: 'Irani Tea', price: 20, isVeg: 1, category: "Tea's", stock: 20 },
      { stallId: 'tea-coffee', name: 'Chocolate Tea', price: 20, isVeg: 1, category: "Tea's", stock: 20 },
      { stallId: 'tea-coffee', name: 'Lemon Tea', price: 20, isVeg: 1, category: "Tea's", stock: 20 },
      { stallId: 'tea-coffee', name: 'Green Tea', price: 20, isVeg: 1, category: "Tea's", stock: 20 },
      { stallId: 'tea-coffee', name: 'Coffee', price: 20, isVeg: 1, category: 'Coffee', stock: 20 },
      { stallId: 'tea-coffee', name: 'Black Coffee', price: 15, isVeg: 1, category: 'Coffee', stock: 20 },
      { stallId: 'tea-coffee', name: 'Hazelnut Coffee', price: 20, isVeg: 1, category: 'Coffee', stock: 20 },
      { stallId: 'tea-coffee', name: 'Cold Coffee', price: 30, isVeg: 1, category: 'Cold Beverages', stock: 20 },

      // rohit-vadewale
      { stallId: 'rohit-vadewale', name: 'Classic Wadapav', price: 25, isVeg: 1, category: 'Wadapav', stock: 20 },
      { stallId: 'rohit-vadewale', name: 'Corn Wadapav', price: 30, isVeg: 1, category: 'Wadapav', stock: 20 },
      { stallId: 'rohit-vadewale', name: 'Paneer Wadapav', price: 49, isVeg: 1, category: 'Wadapav', stock: 20 },
      { stallId: 'rohit-vadewale', name: 'Cheese Wadapav', price: 45, isVeg: 1, category: 'Wadapav', stock: 20 },
      { stallId: 'rohit-vadewale', name: 'Poha', price: 30, isVeg: 1, category: 'Breakfast', stock: 20 },
      { stallId: 'rohit-vadewale', name: 'Upama', price: 30, isVeg: 1, category: 'Breakfast', stock: 20 },
      { stallId: 'rohit-vadewale', name: 'Pavbhaji', price: 80, isVeg: 1, category: 'Pavbhaji', stock: 20 },
      { stallId: 'rohit-vadewale', name: 'Cheese Pavbhaji', price: 110, isVeg: 1, category: 'Pavbhaji', stock: 20 },

      // oodles-of-noodles
      { stallId: 'oodles-of-noodles', name: 'Veg Manchurian', price: 50, isVeg: 1, category: 'Starter', stock: 20 },
      { stallId: 'oodles-of-noodles', name: 'Paneer Chilli', price: 110, isVeg: 1, category: 'Starter', stock: 20 },
      { stallId: 'oodles-of-noodles', name: 'Hakka Noodles', price: 50, isVeg: 1, category: 'Noodles', stock: 20 },
      { stallId: 'oodles-of-noodles', name: 'Schezwan Noodles', price: 60, isVeg: 1, category: 'Noodles', stock: 20 },
      { stallId: 'oodles-of-noodles', name: 'Fried Rice', price: 50, isVeg: 1, category: 'Rice', stock: 20 },
      { stallId: 'oodles-of-noodles', name: 'Schezwan Rice', price: 60, isVeg: 1, category: 'Rice', stock: 20 },
      { stallId: 'oodles-of-noodles', name: 'Cheese Maggi', price: 60, isVeg: 1, category: 'Maggi', stock: 20 },

      // narayana
      { stallId: 'narayana', name: 'Single Idli', price: 20, isVeg: 1, category: "Idli's", stock: 20 },
      { stallId: 'narayana', name: 'Idli Plate (2 Pcs)', price: 35, isVeg: 1, category: "Idli's", stock: 20 },
      { stallId: 'narayana', name: 'Plain Dosa', price: 40, isVeg: 1, category: "Dosa's", stock: 20 },
      { stallId: 'narayana', name: 'Masala Dosa', price: 50, isVeg: 1, category: "Dosa's", stock: 20 },
      { stallId: 'narayana', name: 'Cheese Dosa', price: 60, isVeg: 1, category: "Dosa's", stock: 20 },
      { stallId: 'narayana', name: 'Medu Vada', price: 50, isVeg: 1, category: 'Medu Vada', stock: 20 },
      { stallId: 'narayana', name: 'Appe', price: 50, isVeg: 1, category: 'Appe (7 Pcs)', stock: 20 },
      { stallId: 'narayana', name: 'Aloo Paratha', price: 60, isVeg: 1, category: "Paratha's", stock: 20 },
      { stallId: 'narayana', name: 'Red Sauce Pasta', price: 70, isVeg: 1, category: "Pasta's", stock: 20 },
      { stallId: 'narayana', name: 'White Sauce Pasta', price: 80, isVeg: 1, category: "Pasta's", stock: 20 },

      // cool-cravings
      { stallId: 'cool-cravings', name: 'Cold Coffee', price: 50, isVeg: 1, category: 'Cold Coffee', stock: 20 },
      { stallId: 'cool-cravings', name: 'Thick Cold Coffee', price: 100, isVeg: 1, category: 'Cold Coffee', stock: 20 },
      { stallId: 'cool-cravings', name: 'Mint Mojito', price: 65, isVeg: 1, category: 'Mojito', stock: 20 },
      { stallId: 'cool-cravings', name: 'Blue Curacao', price: 65, isVeg: 1, category: 'Mojito', stock: 20 },
      { stallId: 'cool-cravings', name: 'Oreo Shake', price: 80, isVeg: 1, category: 'Shakes', stock: 20 },
      { stallId: 'cool-cravings', name: 'Kitkat Shake', price: 80, isVeg: 1, category: 'Shakes', stock: 20 },
      { stallId: 'cool-cravings', name: 'Mango Lassi', price: 50, isVeg: 1, category: 'Lassi', stock: 20 },
      { stallId: 'cool-cravings', name: 'Masala Taak', price: 20, isVeg: 1, category: 'Butter Milk', stock: 20 }
    ];

    const itemImagesMap = {
      'Dahi Thalipeeth': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
      'Schezwan Thalipeeth': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
      'Paneer Thalipeeth': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
      'Cheese Thalipeeth': 'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
      'Cheese Paneer Thalipeeth': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
      'Mozzarella Cheese Thalipeeth': 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=400&q=80',
      'Misal': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
      'Dahi Misal': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
      'Cheese Misal': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
      'Extra Bread': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
      'Jumbo Misal': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
      'Masala Rice': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
      'Butter Veg Pulav': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
      'Soya Butter Pulav': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
      'Soya Paneer Pulav': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
      'Paneer Butter Pulav': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
      'Cheese Butter Pulav': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
      'Cheese Paneer Pulav': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
      'Ghee Daal Khichadi': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
      'Masala Dal Khichdi': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
      'Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Mayo Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Lays Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Cheese Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Cheese Veg Wraps (Special)': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Paneer Tikka Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Cheesy Paneer Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Mozzarella Cheese Wrap': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Gulacha Basundi Tea': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
      'Black Tea': 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=400&q=80',
      'Jumbo Tea': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
      'Irani Tea': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
      'Chocolate Tea': 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=400&q=80',
      'Lemon Tea': 'https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=400&q=80',
      'Green Tea': 'https://images.unsplash.com/photo-1627435601361-ec25f5b1d0e5?auto=format&fit=crop&w=400&q=80',
      'Coffee': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80',
      'Black Coffee': 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&w=400&q=80',
      'Hazelnut Coffee': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=400&q=80',
      'Cold Coffee': 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=400&q=80',
      'Classic Wadapav': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
      'Corn Wadapav': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
      'Paneer Wadapav': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
      'Cheese Wadapav': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
      'Poha': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
      'Upama': 'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
      'Pavbhaji': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
      'Cheese Pavbhaji': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
      'Veg Manchurian': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=400&q=80',
      'Paneer Chilli': 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=400&q=80',
      'Hakka Noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
      'Schezwan Noodles': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
      'Fried Rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
      'Schezwan Rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
      'Cheese Maggi': 'https://images.unsplash.com/photo-1612966608997-303747b974a7?auto=format&fit=crop&w=400&q=80',
      'Single Idli': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
      'Idli Plate (2 Pcs)': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
      'Plain Dosa': 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
      'Masala Dosa': 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
      'Cheese Dosa': 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=400&q=80',
      'Medu Vada': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=400&q=80',
      'Appe': 'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
      'Aloo Paratha': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
      'Red Sauce Pasta': 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=400&q=80',
      'White Sauce Pasta': 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=400&q=80',
      'Thick Cold Coffee': 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=400&q=80',
      'Mint Mojito': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
      'Blue Curacao': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
      'Oreo Shake': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
      'Kitkat Shake': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
      'Mango Lassi': 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
      'Masala Taak': 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80'
    };

    for (const item of itemsData) {
      const img = itemImagesMap[item.name] || null;
      await db.run(
        'INSERT INTO menu_items (stallId, name, price, isVeg, category, stock, available, img) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [item.stallId, item.name, item.price, item.isVeg, item.category, item.stock, 1, img]
      );
    }
  }
}

export async function ping() {
  if (isPgActive && pool) {
    const res = await pool.query('SELECT 1');
    return res.rowCount > 0;
  } else if (isSqliteActive && sqliteDb) {
    return new Promise((resolve) => {
      sqliteDb.get('SELECT 1', (err) => {
        resolve(!err);
      });
    });
  }
  return true; // fallback memory engine is always active
}

export async function close() {
  if (pool) {
    await pool.end();
    console.log('[DATABASE] PostgreSQL connection pool closed.');
  }
  if (sqliteDb) {
    await new Promise((resolve, reject) => {
      sqliteDb.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('[DATABASE] SQLite database connection closed.');
  }
}
