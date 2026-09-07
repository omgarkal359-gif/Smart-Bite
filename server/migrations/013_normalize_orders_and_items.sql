-- =============================================================================
-- MIGRATION 013: ORDERS, HISTORICAL SNAPSHOTS & STATUS TRANSITIONS
-- =============================================================================

ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS customer_uuid UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS stall_id TEXT REFERENCES public.stalls(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS stall_name_snapshot TEXT;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_status_valid') THEN
    ALTER TABLE public.orders ADD CONSTRAINT chk_orders_status_valid CHECK (
      status IN ('pending', 'placed', 'accepted', 'preparing', 'ready', 'completed', 'cancelled')
    );
  END IF;
END $$;

ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS menu_item_id INTEGER REFERENCES public.menu_items(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS item_name_snapshot TEXT;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS unit_price_snapshot NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE IF EXISTS public.order_items ADD COLUMN IF NOT EXISTS total_price NUMERIC(12, 2) DEFAULT 0.00;

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id SERIAL PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT DEFAULT 'system',
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
