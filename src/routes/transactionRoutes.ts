import express from 'express';
import {
    getTransactions,
    setTransaction,
} from '../controllers/transactionController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.route('/').get(protect, getTransactions).post(protect, setTransaction);

export default router;
