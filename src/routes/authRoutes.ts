import express from 'express';
import {
    registerUser,
    loginUser,
    getMe,
    updateProfile,
    deleteAccount,
} from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.delete('/account', protect, deleteAccount);

export default router;
