import { Router } from 'express';
import { login, loginGoogle, register, verifyRegistration } from '../controllers/auth.controller.js';
import { validate, loginSchema, registerSchema } from '../utils/validators.js';

const router = Router();

router.post('/login', validate(loginSchema), login);
router.post('/google', loginGoogle);
router.post('/register', validate(registerSchema), register);
router.post('/verify-registration', verifyRegistration);

export default router;
