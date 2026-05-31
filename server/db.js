import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'database.sqlite');

const dbConnection = new sqlite3.Database(dbPath);

// Helper to run query with Promise
export const db = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      dbConnection.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      dbConnection.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      dbConnection.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  exec(sql) {
    return new Promise((resolve, reject) => {
      dbConnection.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

export async function initDatabase() {
  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stallId TEXT,
      name TEXT,
      price REAL,
      isVeg INTEGER,
      category TEXT,
      stock INTEGER,
      available INTEGER DEFAULT 1
    );
  `);

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
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId TEXT,
      itemId INTEGER,
      name TEXT,
      price REAL,
      quantity INTEGER,
      stallId TEXT,
      stallName TEXT
    );
  `);

  // Seed Users if empty
  const userCount = await db.get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
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
  if (stallCount.count === 0) {
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
  if (menuCount.count === 0) {
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

    for (const item of itemsData) {
      await db.run(
        'INSERT INTO menu_items (stallId, name, price, isVeg, category, stock, available) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [item.stallId, item.name, item.price, item.isVeg, item.category, item.stock, 1]
      );
    }
  }
}
