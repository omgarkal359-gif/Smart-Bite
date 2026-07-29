-- SGU Smart-Bite Enterprise Performance Indexes
-- Run this SQL in your Supabase SQL Editor to maximize query & real-time performance.

-- 1. Index on orders customer ID for fast student order history lookup
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);

-- 2. Index on orders status for instant vendor filtering & realtime subscriptions
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

-- 3. Index on stall/shop ID for vendor dashboard order queries
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON public.orders (shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_stall_id ON public.orders (stall_id);

-- 4. Composite index on shop_id + status for vendor active tickets
CREATE INDEX IF NOT EXISTS idx_orders_shop_status ON public.orders (shop_id, status);

-- 5. Index on created_at for fast date sorting & analytics
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

-- 6. Enable Realtime Replication on public.orders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
