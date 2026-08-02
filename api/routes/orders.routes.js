import { Router } from 'express';
import { 
  createOrder, 
  resendReceipt, 
  getActiveQueue, 
  getStudentOrders, 
  getStallOrders, 
  getOrderById, 
  updateOrderStatus 
} from '../controllers/orders.controller.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate, orderSchema, statusUpdateSchema } from '../utils/validators.js';

const router = Router();

// Order placement
router.post('/', requireAuth, validate(orderSchema), createOrder);

// Queue lookups (Must be BEFORE dynamic wildcard :id)
router.get('/queue', getActiveQueue);
router.get('/student/:customerId', requireAuth, getStudentOrders);
router.get('/stall/:stallId', requireAuth, requireRole('owner', 'admin'), getStallOrders);

// Single order management
router.get('/:id', requireAuth, getOrderById);
router.put('/:id/status', requireAuth, requireRole('owner', 'admin'), validate(statusUpdateSchema), updateOrderStatus);
router.post('/:id/resend', requireAuth, resendReceipt);

export default router;
