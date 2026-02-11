import { Router } from 'express';
import loanController from '../loans/loan.controller';
import disbursementController from '../disbursement/disbursement.controller';
import paymentController from '../payments/payment.controller';
import creditController from '../credit/credit.controller';
import {
    getLoanQueryValidators,
    approveLoanValidators,
    rejectLoanValidators,
} from '../loans/loan.validators';
import { refundValidators } from '../payments/payment.routes';
import { validate } from '../../shared/middleware/validate.middleware';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { adminOnly } from '../../shared/middleware/admin.middleware';
import {
    idempotency,
    requireIdempotencyKey,
} from '../../shared/middleware/idempotency.middleware';
import { body } from 'express-validator';

import authController from '../auth/auth.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Administrative operations
 */

// ADMIN AUTH 

/**
 * @swagger
 * /api/admin/auth/register:
 *   post:
 *     summary: Register a new admin
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: Admin registered
 */
router.post('/auth/register', authController.adminRegister);

/**
 * @swagger
 * /api/admin/auth/login:
 *   post:
 *     summary: Login an admin
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Admin login successful
 */
router.post('/auth/login', authController.adminLogin);

// All other admin routes require authentication and admin role
router.use(authenticate, adminOnly);

/**
 * @swagger
 * /api/admin/loans:
 *   get:
 *     summary: Get all loan applications (Admin)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All loans retrieved
 */
router.get('/loans', getLoanQueryValidators, validate, loanController.getAllLoans);

// Get any loan details
router.get('/loans/:id', loanController.getAnyLoan);

// Start loan review
router.post('/loans/:id/review', loanController.startReview);

// Approve loan
router.post(
    '/loans/:id/approve',
    approveLoanValidators,
    validate,
    loanController.approveLoan
);

// Reject loan
router.post(
    '/loans/:id/reject',
    rejectLoanValidators,
    validate,
    loanController.rejectLoan
);


// Disburse approved loan
router.post(
    '/loans/:id/disburse',
    requireIdempotencyKey,
    idempotency,
    disbursementController.disburseLoan
);


// Get repayment schedule for any loan
router.get('/loans/:id/schedule', paymentController.getAdminRepaymentSchedule);

// Get payment history for any loan
router.get('/loans/:id/payments', paymentController.getAdminLoanPayments);

// Process refund
router.post(
    '/payments/:id/refund',
    idempotency,
    refundValidators,
    validate,
    paymentController.processRefund
);


// Get credit report for any user
router.get('/credit/:userId', creditController.getAdminCreditReport);

// Perform credit check for any user
router.post(
    '/credit/:userId/check',
    [
        body('amount')
            .isNumeric()
            .withMessage('Amount must be a number')
            .custom((value) => value >= 1000)
            .withMessage('Minimum amount is 1000'),
    ],
    validate,
    creditController.adminCreditCheck
);

export default router;
