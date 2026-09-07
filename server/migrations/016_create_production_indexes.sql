-- =============================================================================
-- MIGRATION 016: PERFORMANCE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_vendors_user_id ON public.vendors(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_payout_vendor_id ON public.vendor_payout_accounts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_stalls_vendor_id ON public.stalls(vendor_id);
CREATE INDEX IF NOT EXISTS idx_stalls_category_id ON public.stalls(category_id);
CREATE INDEX IF NOT EXISTS idx_stalls_is_online ON public.stalls(is_online) WHERE is_online = true;
CREATE INDEX IF NOT EXISTS idx_menu_categories_stall_id ON public.menu_categories(stall_id, display_order);
CREATE INDEX IF NOT EXISTS idx_menu_items_stall_id ON public.menu_items(stallId);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON public.menu_items(stallId, is_available) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_uuid ON public.orders(customer_uuid);
CREATE INDEX IF NOT EXISTS idx_orders_stall_id_status ON public.orders(stall_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_receipts_order_id ON public.receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON public.audit_logs(actor_id, created_at DESC);
