-- =============================================================================
-- MIGRATION 012: NORMALIZE MENU CATEGORIES & MENU ITEMS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.menu_categories (
  id SERIAL PRIMARY KEY,
  stall_id TEXT NOT NULL REFERENCES public.stalls(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_stall_category_name UNIQUE(stall_id, name)
);

ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES public.menu_categories(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS preparation_time INTEGER DEFAULT 10;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS is_vegetarian BOOLEAN DEFAULT TRUE;
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_menu_items_price_nonnegative') THEN
    ALTER TABLE public.menu_items ADD CONSTRAINT chk_menu_items_price_nonnegative CHECK (price >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_menu_items_stock_nonnegative') THEN
    ALTER TABLE public.menu_items ADD CONSTRAINT chk_menu_items_stock_nonnegative CHECK (stock >= 0);
  END IF;
END $$;
