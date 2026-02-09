import { Router } from 'express';
import loanController from './loan.controller';
import paymentController from '../payments/payment.controller';
import disbursementController from '../disbursement/disbursement.controller';
import {
    createLoanValidators,
    getLoanQueryValidators,
} from './loan.validators';
import { repaymentValidators } from '../payments/payment.routes';
import { validate } from '../../shared/middleware/validate.middleware';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { idempotency } from '../../shared/middleware/idempotency.middleware';

const router = Router();

// ============ USER ROUTES ============
// All routes require authentication
router.use(authenticate);

// Submit loan application
router.post('/', createLoanValidators, validate, loanController.createLoan);

// Get user's loans
router.get('/', getLoanQueryValidators, validate, loanController.getMyLoans);

// Get single loan
router.get('/:id', loanController.getLoan);

// Get loan status history
router.get('/:id/history', loanController.getLoanHistory);

// Get repayment schedule
router.get('/:id/schedule', paymentController.getRepaymentSchedule);

// Get payment history for a loan
router.get('/:id/payments', paymentController.getLoanPayments);

// Get disbursement details
router.get('/:id/disbursement', disbursementController.getDisbursementDetails);

// Make repayment
router.post(
    '/:id/repay',
    idempotency,
    repaymentValidators,
    validate,
    paymentController.makeRepayment
);

export default router;
