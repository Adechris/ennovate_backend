import { Router } from 'express';
import paymentController from './payment.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { body, query } from 'express-validator';
import { validate } from '../../shared/middleware/validate.middleware';
import { idempotency } from '../../shared/middleware/idempotency.middleware';
import { uploadReceipt, validateFileContent } from '../../shared/middleware/upload.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Repayments and payment history
 */

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Get user's payment history
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment history retrieved
 */
router.get(
    '/',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    validate,
    paymentController.getMyPayments
);

/**
 * @swagger
 * /api/payments/manual:
 *   post:
 *     summary: Submit manual repayment information
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - loanId
 *               - amount
 *               - proofOfPayment
 *             properties:
 *               loanId:
 *                 type: string
 *               amount:
 *                 type: number
 *               proofOfPayment:
 *                 type: string
 *     responses:
 *       200:
 *         description: Manual repayment submitted
 */
router.post(
    '/manual',
    [
        body('loanId').isMongoId().withMessage('Invalid loan ID'),
        body('amount').isNumeric().custom(v => v > 0).withMessage('Amount must be greater than 0'),
        body('proofOfPayment').trim().notEmpty().withMessage('Proof of payment information is required'),
    ],
    validate,
    paymentController.submitManualRepayment
);

/**
 * @swagger
 * /api/payments/manual-with-receipt:
 *   post:
 *     summary: Submit manual repayment with receipt upload
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               loanId:
 *                 type: string
 *               amount:
 *                 type: number
 *               receipt:
 *                 type: string
 *                 format: binary
 *               senderBank:
 *                 type: string
 *               senderName:
 *                 type: string
 *               externalReference:
 *                 type: string
 *     responses:
 *       200:
 *         description: Manual repayment with receipt submitted
 */
router.post(
    '/manual-with-receipt',
    uploadReceipt.single('receipt'),
    validateFileContent,
    [
        body('loanId').isMongoId().withMessage('Invalid loan ID'),
        body('amount').isNumeric().withMessage('Amount is required and must be a number'),
        body('senderBank').trim().notEmpty().withMessage('Sender bank name is required'),
        body('senderName').trim().notEmpty().withMessage('Sender name is required'),
        body('externalReference').trim().notEmpty().withMessage('Transfer reference is required'),
    ],
    validate,
    paymentController.submitManualRepaymentWithReceipt
);

// Admin routes
router.get(
    '/admin/all',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
    ],
    validate,
    paymentController.getAllPayments
);

// Verify manual repayment (Admin)
router.post(
    '/admin/:id/verify',
    [
        body('status').isIn(['success', 'failed']).withMessage('Invalid status'),
        body('reason').optional().trim(),
    ],
    validate,
    paymentController.verifyRepayment
);

// Process overpayment refund (Admin)
router.post(
    '/admin/:id/refund-overpayment',
    [
        body('reason').optional().trim(),
    ],
    validate,
    paymentController.refundOverpayment
);

export default router;

// Validators
export const repaymentValidators = [
    body('amount')
        .isNumeric()
        .withMessage('Amount must be a number')
        .custom((value) => value > 0)
        .withMessage('Amount must be greater than 0'),
];

export const refundValidators = [
    body('reason')
        .trim()
        .notEmpty()
        .withMessage('Refund reason is required')
        .isLength({ max: 500 })
        .withMessage('Reason cannot exceed 500 characters'),
];
