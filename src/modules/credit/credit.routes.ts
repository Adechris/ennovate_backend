import { Router } from 'express';
import creditController from './credit.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../../shared/middleware/validate.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get current user's credit report
router.get('/report', creditController.getCreditReport);

// Perform credit check for specific amount
router.post(
    '/check',
    [
        body('amount')
            .isNumeric()
            .withMessage('Amount must be a number')
            .custom((value) => value >= 1000)
            .withMessage('Minimum amount is 1000'),
    ],
    validate,
    creditController.performCreditCheck
);

export default router;
