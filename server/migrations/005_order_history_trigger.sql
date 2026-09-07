-- =============================================================================
-- Migration: 005_order_history_trigger.sql
-- Description: Automated order lifecycle tracking trigger in PostgreSQL
-- Automatically logs status transitions into order_status_history
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.order_status_history (order_id, previous_status, new_status, changed_by, reason)
    VALUES (NEW.id, NULL, NEW.status, COALESCE(NEW.customer_name, NEW.customerName, 'student'), 'Order placed');
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.order_status_history (order_id, previous_status, new_status, changed_by, reason)
    VALUES (NEW.id, OLD.status, NEW.status, 'system', 'Status transition');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if present
DROP TRIGGER IF EXISTS trg_order_status_change ON public.orders;

-- Create trigger on orders table
CREATE TRIGGER trg_order_status_change
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_order_status_change();
