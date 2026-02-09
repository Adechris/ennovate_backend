import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ApiResponse } from '../utils/api-response';

/**
 * Middleware to check validation results
 */
export const validate = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map((error) => ({
            field: (error as any).path,
            message: error.msg,
        }));

        ApiResponse.validationError(res, errorMessages);
        return;
    }

    next();
};
