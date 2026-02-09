import { Request, Response, NextFunction } from 'express';
import IdempotencyRecord from '../models/idempotency.model';
import { ApiResponse } from '../utils/api-response';

/**
 * Idempotency middleware for critical operations
 * Checks for Idempotency-Key header and returns cached response if exists
 */
export const idempotency = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const idempotencyKey = req.headers['idempotency-key'] as string;

    // If no idempotency key provided, continue normally
    if (!idempotencyKey) {
        return next();
    }

    try {
        // Check if we have a cached response for this key
        const existingRecord = await IdempotencyRecord.findOne({
            key: idempotencyKey,
        });

        if (existingRecord) {
            // Return cached response
            res.status(existingRecord.statusCode).json(existingRecord.responseBody);
            return;
        }

        // Store original res.json to intercept response
        const originalJson = res.json.bind(res);

        res.json = function (body: any): Response {
            // Save the response for future idempotent requests
            IdempotencyRecord.create({
                key: idempotencyKey,
                endpoint: req.originalUrl,
                method: req.method,
                statusCode: res.statusCode,
                responseBody: body,
                userId: req.user?._id,
            }).catch((err) => {
                console.error('Failed to save idempotency record:', err);
            });

            return originalJson(body);
        };

        next();
    } catch (error) {
        // If there's an error checking idempotency, continue with the request
        console.error('Idempotency check error:', error);
        next();
    }
};

/**
 * Middleware that requires idempotency key for the request
 */
export const requireIdempotencyKey = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const idempotencyKey = req.headers['idempotency-key'] as string;

    if (!idempotencyKey) {
        ApiResponse.error(
            res,
            'Idempotency-Key header is required for this operation',
            400
        );
        return;
    }

    next();
};
