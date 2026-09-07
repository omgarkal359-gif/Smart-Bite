-- =============================================================================
-- Migration: 002_schema_normalization.sql
-- Description: Additive schema normalization for SmartBite Supabase PostgreSQL
-- Adds missing columns, snake_case aliases, and CHECK constraints safely.
-- =============================================================================

-- 1. USERS TABLE ENHANCEMENTS
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS roll_number TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'ACTIVE';
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Check constraint on user account status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_account_status'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_account_status 
      CHECK (account_status IN ('ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'));
  END IF;
END $$;

-- 2. STALLS TABLE ENHANCEMENTS
ALTER TABLE IF EXISTS stalls ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS stalls ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN DEFAULT FALSE;
ALTER TABLE IF EXISTS stalls ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE IF EXISTS stalls ADD COLUMN IF NOT EXISTS operating_hours TEXT DEFAULT '08:00 AM - 08:00 PM';
ALTER TABLE IF EXISTS stalls ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS stalls ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. MENU_ITEMS TABLE ENHANCEMENTS
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS preparation_time INTEGER DEFAULT 10;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS category_id INTEGER;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS menu_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Check constraint on price and stock
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_menu_items_price'
  ) THEN
    ALTER TABLE menu_items ADD CONSTRAINT chk_menu_items_price CHECK (price >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_menu_items_stock'
  ) THEN
    ALTER TABLE menu_items ADD CONSTRAINT chk_menu_items_stock CHECK (stock >= 0);
  END IF;
END $$;

-- 4. ORDERS TABLE ENHANCEMENTS
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS tax NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Check constraint on order total_amount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_total_amount'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT chk_orders_total_amount CHECK (total_amount >= 0 OR total >= 0);
  END IF;
END $$;

-- 5. ORDER_ITEMS TABLE ENHANCEMENTS
ALTER TABLE IF EXISTS order_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS order_items ADD COLUMN IF NOT EXISTS total_price NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Check constraints on order items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_items_quantity'
  ) THEN
    ALTER TABLE order_items ADD CONSTRAINT chk_order_items_quantity CHECK (quantity > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_items_price'
  ) THEN
    ALTER TABLE order_items ADD CONSTRAINT chk_order_items_price CHECK (price >= 0 OR unit_price >= 0);
  END IF;
END $$;
