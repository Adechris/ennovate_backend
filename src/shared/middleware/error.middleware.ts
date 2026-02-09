import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error';
import { ApiResponse } from '../utils/api-response';

/**
 * Global error handling middleware
 */
export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Log error for debugging
    console.error('Error:', {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });

    // Handle AppError instances
    if (err instanceof AppError) {
        ApiResponse.error(res, err.message, err.statusCode);
        return;
    }

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        const mongooseError = err as any;
        const errors = Object.values(mongooseError.errors).map(
            (e: any) => e.message
        );
        ApiResponse.validationError(res, errors, 'Validation failed');
        return;
    }

    // Handle Mongoose duplicate key errors
    if ((err as any).code === 11000) {
        const field = Object.keys((err as any).keyValue)[0];
        ApiResponse.error(res, `${field} already exists`, 409);
        return;
    }

    // Handle Mongoose cast errors (invalid ObjectId)
    if (err.name === 'CastError') {
        ApiResponse.error(res, 'Invalid ID format', 400);
        return;
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        ApiResponse.unauthorized(res, 'Invalid token');
        return;
    }

    if (err.name === 'TokenExpiredError') {
        ApiResponse.unauthorized(res, 'Token expired');
        return;
    }

    // Default error response
    const statusCode = (err as any).statusCode || 500;
    const message =
        process.env.NODE_ENV === 'production'
            ? 'Something went wrong'
            : err.message;

    ApiResponse.error(res, message, statusCode);
};

/**
 * Handle 404 - Not Found routes
 */
export const notFoundHandler = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    ApiResponse.notFound(res, `Route ${req.originalUrl} not found`);
};

/**
 * Async handler wrapper to avoid try-catch in every controller
 */
export const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
