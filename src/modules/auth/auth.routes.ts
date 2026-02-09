import { Router } from 'express';
import authController from './auth.controller';
import {
    registerValidators,
    loginValidators,
    updateProfileValidators,
} from './auth.validators';
import { validate } from '../../shared/middleware/validate.middleware';
import { authenticate } from '../../shared/middleware/auth.middleware';

const router = Router();

// Public routes
router.post('/register', registerValidators, validate, authController.register);
router.post('/login', loginValidators, validate, authController.login);

// Protected routes
router.get('/me', authenticate, authController.getProfile);
router.put(
    '/profile',
    authenticate,
    updateProfileValidators,
    validate,
    authController.updateProfile
);

export default router;
