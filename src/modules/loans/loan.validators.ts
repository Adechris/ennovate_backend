import { body, query } from 'express-validator';
import { LoanStatus } from './loan.model';

export const createLoanValidators = [
    body('amount')
        .isNumeric()
        .withMessage('Amount must be a number')
        .custom((value) => value >= 1000)
        .withMessage('Minimum loan amount is 1000'),
    body('tenor')
        .isInt({ min: 1, max: 60 })
        .withMessage('Tenor must be between 1 and 60 months'),
    body('purpose')
        .trim()
        .notEmpty()
        .withMessage('Purpose is required')
        .isLength({ max: 500 })
        .withMessage('Purpose cannot exceed 500 characters'),
];

export const getLoanQueryValidators = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    query('status')
        .optional()
        .isIn(Object.values(LoanStatus))
        .withMessage('Invalid status'),
];

export const approveLoanValidators = [
    body('approvedAmount')
        .optional()
        .isNumeric()
        .withMessage('Approved amount must be a number')
        .custom((value) => value >= 1000)
        .withMessage('Minimum approved amount is 1000'),
    body('conditions')
        .optional()
        .isArray()
        .withMessage('Conditions must be an array'),
    body('conditions.*')
        .optional()
        .isString()
        .withMessage('Each condition must be a string'),
];

export const rejectLoanValidators = [
    body('reason')
        .trim()
        .notEmpty()
        .withMessage('Rejection reason is required')
        .isLength({ max: 1000 })
        .withMessage('Reason cannot exceed 1000 characters'),
];
