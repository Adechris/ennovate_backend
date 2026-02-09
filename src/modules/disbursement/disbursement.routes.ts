import { Router } from 'express';
import disbursementController from './disbursement.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../../shared/middleware/validate.middleware';
import {
    idempotency,
    requireIdempotencyKey,
} from '../../shared/middleware/idempotency.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get disbursement details for a loan
router.get('/:loanId', disbursementController.getDisbursementDetails);

export default router;

// Validators for disbursement
export const disburseLoanValidators = [
    body('bankAccount')
        .trim()
        .notEmpty()
        .withMessage('Bank account number is required')
        .isLength({ min: 10, max: 10 })
        .withMessage('Bank account must be 10 digits'),
    body('bankCode')
        .trim()
        .notEmpty()
        .withMessage('Bank code is required'),
];
