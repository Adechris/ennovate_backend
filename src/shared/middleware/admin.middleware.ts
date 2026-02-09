import { Request, Response, NextFunction } from 'express';
import { AuthorizationError } from '../utils/app-error';

/**
 * Middleware to restrict access to admin users only
 */
export const adminOnly = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (!req.user) {
        return next(new AuthorizationError('Authentication required'));
    }

    if (req.user.role !== 'admin') {
        return next(new AuthorizationError('Admin access required'));
    }

    next();
};

/**
 * Middleware to restrict access to specific roles
 */
export const restrictTo = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            return next(new AuthorizationError('Authentication required'));
        }

        if (!roles.includes(req.user.role)) {
            return next(
                new AuthorizationError(
                    `Access restricted to: ${roles.join(', ')}`
                )
            );
        }

        next();
    };
};
