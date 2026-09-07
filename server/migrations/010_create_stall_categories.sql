-- =============================================================================
-- MIGRATION 010: STALL CATEGORIES LOOKUP
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.stall_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.stall_categories (name, description, icon)
VALUES
  ('Fast Food & Snacks', 'Quick bites, wadapav, samosas and snacks', '🥟'),
  ('Beverages & Desserts', 'Teas, coffees, shakes and desserts', '☕'),
  ('South Indian', 'Idli, dosa, vada and South Indian delights', '🥘'),
  ('Chinese & Noodles', 'Noodles, fried rice and Indo-Chinese fusion', '🍜'),
  ('Snacks & Beverages', 'General beverages and multi-cuisine snacks', '🥪')
ON CONFLICT (name) DO NOTHING;
