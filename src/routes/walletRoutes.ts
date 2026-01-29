import express from 'express';
import { getWallet } from '../controllers/walletController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.get('/', protect, getWallet);

export default router;
