import { Router } from 'express';
import creditController from './credit.controller';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { body } from 'express-validator';
import { validate } from '../../shared/middleware/validate.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Credit
 *   description: Credit reporting and checking
 */

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/credit/report:
 *   get:
 *     summary: Get current user's credit report
 *     tags: [Credit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Credit report retrieved
 */
router.get('/report', creditController.getCreditReport);

/**
 * @swagger
 * /api/credit/check:
 *   post:
 *     summary: Perform credit check for a specific amount
 *     tags: [Credit]
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
 *             properties:
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Credit check performed
 */
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
