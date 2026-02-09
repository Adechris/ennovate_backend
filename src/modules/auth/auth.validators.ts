import { body } from 'express-validator';

export const registerValidators = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters'),
    body('firstName')
        .trim()
        .notEmpty()
        .withMessage('First name is required')
        .isLength({ max: 50 })
        .withMessage('First name cannot exceed 50 characters'),
    body('lastName')
        .trim()
        .notEmpty()
        .withMessage('Last name is required')
        .isLength({ max: 50 })
        .withMessage('Last name cannot exceed 50 characters'),
    body('phone')
        .trim()
        .notEmpty()
        .withMessage('Phone number is required'),
    body('bvn')
        .optional()
        .isLength({ min: 11, max: 11 })
        .withMessage('BVN must be exactly 11 digits')
        .isNumeric()
        .withMessage('BVN must contain only numbers'),
];

export const loginValidators = [
    body('email')
        .isEmail()
        .withMessage('Please provide a valid email')
        .normalizeEmail(),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
];

export const updateProfileValidators = [
    body('firstName')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('First name cannot exceed 50 characters'),
    body('lastName')
        .optional()
        .trim()
        .isLength({ max: 50 })
        .withMessage('Last name cannot exceed 50 characters'),
    body('phone')
        .optional()
        .trim(),
    body('bvn')
        .optional()
        .isLength({ min: 11, max: 11 })
        .withMessage('BVN must be exactly 11 digits')
        .isNumeric()
        .withMessage('BVN must contain only numbers'),
];
