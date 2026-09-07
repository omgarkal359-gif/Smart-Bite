-- =============================================================================
-- Migration: 004_performance_indexes.sql
-- Description: Production database indexing strategy for high throughput queries
-- =============================================================================

-- Orders Query Optimization
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_customerId ON orders (customerId);
CREATE INDEX IF NOT EXISTS idx_orders_stall_id_status ON orders (stall_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at DESC);

-- Order Items Query Optimization
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_orderId ON order_items (orderId);
CREATE INDEX IF NOT EXISTS idx_order_items_stall_id ON order_items (stall_id);

-- Menu Items & Categories Query Optimization
CREATE INDEX IF NOT EXISTS idx_menu_items_stall_id ON menu_items (stallId);
CREATE INDEX IF NOT EXISTS idx_menu_items_stall_category ON menu_items (stallId, category);
CREATE INDEX IF NOT EXISTS idx_menu_categories_stall ON menu_categories (stall_id, display_order);

-- Audit Logs & Notifications Query Optimization
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_severity ON audit_logs (actor_id, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications (user_id, is_read, created_at DESC);

-- Realtime Publication Enablement for Auxiliary Tables
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_status_history;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
