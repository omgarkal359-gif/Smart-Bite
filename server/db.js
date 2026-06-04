import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env variables
dotenv.config({ path: join(__dirname, '.env') });

// Configure pg to parse INT8 (bigint) as Javascript number
pg.types.setTypeParser(pg.types.builtins.INT8, (val) => parseInt(val, 10));

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.hmdewtmtxgfyunyypcon:Omharsh@2006@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

if (!connectionString || connectionString.includes('[YOUR-PASSWORD]')) {
  console.warn('\n==================================================');
  console.warn('WARNING: Supabase DATABASE_URL is not configured yet.');
  console.warn('Please update the PASSWORD in server/.env to start the database connection.');
  console.warn('==================================================\n');
}

const pool = new pg.Pool({
  connectionString: connectionString,
  ssl: connectionString && (connectionString.includes('supabase.co') || connectionString.includes('supabase.com') || connectionString.includes('supabase'))
    ? { rejectUnauthorized: false }
    : false
});

// Helper to convert SQLite '?' to Postgres '$1', '$2', ...
function convertSql(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

export const db = {
  async run(sql, params = []) {
    let pgSql = convertSql(sql);
    
    // If it's an INSERT statement, we automatically append RETURNING id
    // to match SQLite's `{ id: lastID }` behavior
    if (pgSql.trim().toUpperCase().startsWith('INSERT ')) {
      if (!pgSql.trim().toUpperCase().includes('RETURNING')) {
        pgSql = `${pgSql} RETURNING id`;
      }
      const res = await pool.query(pgSql, params);
      return { id: res.rows[0]?.id, changes: res.rowCount };
    }
    
    const res = await pool.query(pgSql, params);
    return { id: null, changes: res.rowCount };
  },

  async all(sql, params = []) {
    const pgSql = convertSql(sql);
    const res = await pool.query(pgSql, params);
    return res.rows;
  },

  async get(sql, params = []) {
    const pgSql = convertSql(sql);
    const res = await pool.query(pgSql, params);
    return res.rows[0] || null;
  },

  async exec(sql) {
    const pgSql = convertSql(sql);
    await pool.query(pgSql);
  }
};

export async function initDatabase() {
  if (!connectionString || connectionString.includes('[YOUR-PASSWORD]')) {
    throw new Error('Database initialization aborted: Supabase DATABASE_URL password has not been configured in server/.env.');
  }

  // Create tables using Postgres syntax
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
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
      id SERIAL PRIMARY KEY,
      stallId TEXT,
      name TEXT,
      price REAL,
      isVeg INTEGER,
      category TEXT,
      stock INTEGER,
      img TEXT,
      available INTEGER DEFAULT 1
    );
  `);

  // Migration: Ensure 'img' column exists on menu_items table
  await db.exec('ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS img TEXT;');


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
      id SERIAL PRIMARY KEY,
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

    const itemImagesMap = {
      // Thalipeeth
      'Dahi Thalipeeth': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
      'Schezwan Thalipeeth': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
      'Paneer Thalipeeth': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
      'Cheese Thalipeeth': 'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
      'Cheese Paneer Thalipeeth': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
      'Mozzarella Cheese Thalipeeth': 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=400&q=80',
      
      // Misal
      'Misal': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
      'Dahi Misal': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
      'Cheese Misal': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
      'Extra Bread': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
      'Jumbo Misal': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
      
      // Rice
      'Masala Rice': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
      'Butter Veg Pulav': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
      'Soya Butter Pulav': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
      'Soya Paneer Pulav': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
      'Paneer Butter Pulav': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
      'Cheese Butter Pulav': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
      'Cheese Paneer Pulav': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
      'Ghee Daal Khichadi': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
      'Masala Dal Khichdi': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
      
      // Veg Wraps
      'Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Mayo Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Lays Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Cheese Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Cheese Veg Wraps (Special)': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Paneer Tikka Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Cheesy Paneer Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      'Mozzarella Cheese Wrap': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
      
      // Tea's
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
      
      // Wadapav
      'Classic Wadapav': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
      'Corn Wadapav': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
      'Paneer Wadapav': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
      'Cheese Wadapav': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
      'Poha': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
      'Upama': 'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
      'Pavbhaji': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
      'Cheese Pavbhaji': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
      
      // Starter / Chinese
      'Veg Manchurian': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=400&q=80',
      'Paneer Chilli': 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=400&q=80',
      'Hakka Noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
      'Schezwan Noodles': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
      'Fried Rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
      'Schezwan Rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
      'Cheese Maggi': 'https://images.unsplash.com/photo-1612966608997-303747b974a7?auto=format&fit=crop&w=400&q=80',
      
      // South Indian
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
      
      // Shakes / drinks
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

  // Ensure all existing items in the database have their correct images populated/updated
  const itemImagesMap = {
    // Thalipeeth
    'Dahi Thalipeeth': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
    'Schezwan Thalipeeth': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
    'Paneer Thalipeeth': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
    'Cheese Thalipeeth': 'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
    'Cheese Paneer Thalipeeth': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
    'Mozzarella Cheese Thalipeeth': 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=400&q=80',
    
    // Misal
    'Misal': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
    'Dahi Misal': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
    'Cheese Misal': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
    'Extra Bread': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80',
    'Jumbo Misal': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
    
    // Rice
    'Masala Rice': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
    'Butter Veg Pulav': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
    'Soya Butter Pulav': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
    'Soya Paneer Pulav': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
    'Paneer Butter Pulav': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
    'Cheese Butter Pulav': 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=400&q=80',
    'Cheese Paneer Pulav': 'https://images.unsplash.com/photo-1633945274405-b6c8069047b0?auto=format&fit=crop&w=400&q=80',
    'Ghee Daal Khichadi': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
    'Masala Dal Khichdi': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
    
    // Veg Wraps
    'Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
    'Mayo Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
    'Lays Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
    'Cheese Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
    'Cheese Veg Wraps (Special)': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
    'Paneer Tikka Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
    'Cheesy Paneer Veg Wraps': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
    'Mozzarella Cheese Wrap': 'https://images.unsplash.com/photo-1626700051175-6518c4793f4f?auto=format&fit=crop&w=400&q=80',
    
    // Tea's
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
    
    // Wadapav
    'Classic Wadapav': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
    'Corn Wadapav': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
    'Paneer Wadapav': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
    'Cheese Wadapav': 'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=400&q=80',
    'Poha': 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=400&q=80',
    'Upama': 'https://images.unsplash.com/photo-1608797178974-15b35a61d121?auto=format&fit=crop&w=400&q=80',
    'Pavbhaji': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
    'Cheese Pavbhaji': 'https://images.unsplash.com/photo-1606491956689-2ea866880c84?auto=format&fit=crop&w=400&q=80',
    
    // Starter / Chinese
    'Veg Manchurian': 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=400&q=80',
    'Paneer Chilli': 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=400&q=80',
    'Hakka Noodles': 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=400&q=80',
    'Schezwan Noodles': 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=400&q=80',
    'Fried Rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
    'Schezwan Rice': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=400&q=80',
    'Cheese Maggi': 'https://images.unsplash.com/photo-1612966608997-303747b974a7?auto=format&fit=crop&w=400&q=80',
    
    // South Indian
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
    
    // Shakes / drinks
    'Thick Cold Coffee': 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=400&q=80',
    'Mint Mojito': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
    'Blue Curacao': 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=400&q=80',
    'Oreo Shake': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
    'Kitkat Shake': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=400&q=80',
    'Mango Lassi': 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80',
    'Masala Taak': 'https://images.unsplash.com/photo-1541658016709-82535e94bc69?auto=format&fit=crop&w=400&q=80'
  };

  for (const [name, imgUrl] of Object.entries(itemImagesMap)) {
    await db.run('UPDATE menu_items SET img = ? WHERE name = ?', [imgUrl, name]);
  }
}

