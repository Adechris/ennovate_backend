import crypto from 'crypto';

/**
 * Generate a unique application/reference number
 */
export const generateApplicationNumber = (prefix: string = 'LN'): string => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
};

/**
 * Generate a unique reference for transactions
 */
export const generateReference = (prefix: string = 'TXN'): string => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
};

/**
 * Calculate simple interest
 * Formula: Interest = Principal × Rate × Time
 */
export const calculateSimpleInterest = (
    principal: number,
    annualRate: number,
    tenorInMonths: number
): number => {
    const timeInYears = tenorInMonths / 12;
    return principal * annualRate * timeInYears;
};

/**
 * Calculate monthly payment for a loan
 */
export const calculateMonthlyPayment = (
    totalRepayable: number,
    tenorInMonths: number
): number => {
    return Math.ceil((totalRepayable / tenorInMonths) * 100) / 100;
};

/**
 * Round to 2 decimal places
 */
export const roundToTwoDecimals = (value: number): number => {
    return Math.round(value * 100) / 100;
};

/**
 * Format currency (Nigerian Naira)
 */
export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
    }).format(amount);
};

/**
 * Add months to a date
 */
export const addMonths = (date: Date, months: number): Date => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
};

/**
 * Check if a date is overdue
 */
export const isOverdue = (dueDate: Date): boolean => {
    return new Date() > dueDate;
};

/**
 * Sleep for specified milliseconds (useful for testing)
 */
export const sleep = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
