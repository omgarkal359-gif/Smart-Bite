import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1).max(255).trim(),
  password: z.string().max(128).optional(),
  role: z.enum(['student', 'guest', 'owner', 'admin']).optional(),
  name: z.string().max(255).optional()
});

export const registerSchema = z.object({
  username: z.string().min(3).max(255).trim(),
  name: z.string().min(1).max(255).trim(),
  password: z.string().min(6).max(128),
  role: z.enum(['student', 'guest']).optional()
});

export const orderSchema = z.object({
  customerName: z.string().min(1).max(255),
  customerId: z.string().min(1).max(255),
  type: z.string().max(50).optional(),
  payment: z.string().max(50).optional(),
  total: z.number().positive().max(100000),
  items: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string().max(255),
    price: z.number().nonnegative(),
    quantity: z.number().int().positive().max(100),
    stallId: z.string().max(255),
    stallName: z.string().max(255).optional()
  })).min(1),
  id: z.string().max(255).optional(),
  orderId: z.string().max(255).optional(),
  utr: z.string().max(64).optional()
});

export const statusUpdateSchema = z.object({
  status: z.enum(['placed', 'pending_cash', 'preparing', 'ready', 'completed', 'cancelled'])
});

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * On success, sets req.validatedBody with the parsed data.
 * On failure, returns 400 with validation error messages.
 *
 * @param {z.ZodSchema} schema
 * @returns {Function} Express middleware
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data.',
        errors: result.error.issues.map(i => i.message)
      });
    }
    req.validatedBody = result.data;
    next();
  };
}
