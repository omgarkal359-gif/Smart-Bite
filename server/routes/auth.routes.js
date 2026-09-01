import { Router } from 'express';
import { login, loginGoogle, register, verifyRegistration, getMe } from '../controllers/auth.controller.js';
import { validate, loginSchema, registerSchema } from '../utils/validators.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/google', loginGoogle);
router.post('/login-google', loginGoogle);
router.post('/register', validate(registerSchema), register);
router.post('/verify-registration', verifyRegistration);
router.get('/me', requireAuth, getMe);

export default router;
