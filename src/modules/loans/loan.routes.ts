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

/**
 * @swagger
 * tags:
 *   name: Loans
 *   description: Loan applications and management
 */

// ============ USER ROUTES ============
// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/loans:
 *   post:
 *     summary: Submit a new loan application
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - duration
 *               - purpose
 *             properties:
 *               amount:
 *                 type: number
 *               duration:
 *                 type: number
 *                 description: Duration in months
 *               purpose:
 *                 type: string
 *     responses:
 *       201:
 *         description: Loan application submitted successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/', createLoanValidators, validate, loanController.createLoan);

/**
 * @swagger
 * /api/loans:
 *   get:
 *     summary: Get user's loan applications
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by loan status
 *     responses:
 *       200:
 *         description: List of user's loans
 *       401:
 *         description: Unauthorized
 */
router.get('/', getLoanQueryValidators, validate, loanController.getMyLoans);

/**
 * @swagger
 * /api/loans/{id}:
 *   get:
 *     summary: Get details of a specific loan
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Loan ID
 *     responses:
 *       200:
 *         description: Loan details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Loan not found
 */
router.get('/:id', loanController.getLoan);

/**
 * @swagger
 * /api/loans/{id}/history:
 *   get:
 *     summary: Get loan status history
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Loan history retrieved
 */
router.get('/:id/history', loanController.getLoanHistory);

/**
 * @swagger
 * /api/loans/{id}/schedule:
 *   get:
 *     summary: Get loan repayment schedule
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Repayment schedule retrieved
 */
router.get('/:id/schedule', paymentController.getRepaymentSchedule);

/**
 * @swagger
 * /api/loans/{id}/payments:
 *   get:
 *     summary: Get payment history for a loan
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment history retrieved
 */
router.get('/:id/payments', paymentController.getLoanPayments);

/**
 * @swagger
 * /api/loans/{id}/disbursement:
 *   get:
 *     summary: Get disbursement details for a loan
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Disbursement details retrieved
 */
router.get('/:id/disbursement', disbursementController.getDisbursementDetails);

/**
 * @swagger
 * /api/loans/{id}/repay:
 *   post:
 *     summary: Make a loan repayment
 *     tags: [Loans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: header
 *         name: Idempotency-Key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Repayment successful
 *       400:
 *         description: Invalid input
 */
router.post(
    '/:id/repay',
    idempotency,
    repaymentValidators,
    validate,
    paymentController.makeRepayment
);

export default router;
