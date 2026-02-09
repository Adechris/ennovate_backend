import { Response } from 'express';

interface ApiResponseOptions {
    success: boolean;
    message: string;
    data?: any;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        totalPages?: number;
    };
    errors?: any[];
}

export class ApiResponse {
    /**
     * Send a success response
     */
    static success(
        res: Response,
        data: any = null,
        message: string = 'Success',
        statusCode: number = 200,
        meta?: ApiResponseOptions['meta']
    ): Response {
        const response: ApiResponseOptions = {
            success: true,
            message,
            data,
        };

        if (meta) {
            response.meta = meta;
        }

        return res.status(statusCode).json(response);
    }

    /**
     * Send a created response (201)
     */
    static created(
        res: Response,
        data: any = null,
        message: string = 'Resource created successfully'
    ): Response {
        return this.success(res, data, message, 201);
    }

    /**
     * Send an error response
     */
    static error(
        res: Response,
        message: string = 'An error occurred',
        statusCode: number = 500,
        errors?: any[]
    ): Response {
        const response: ApiResponseOptions = {
            success: false,
            message,
        };

        if (errors && errors.length > 0) {
            response.errors = errors;
        }

        return res.status(statusCode).json(response);
    }

    /**
     * Send a not found response (404)
     */
    static notFound(
        res: Response,
        message: string = 'Resource not found'
    ): Response {
        return this.error(res, message, 404);
    }

    /**
     * Send an unauthorized response (401)
     */
    static unauthorized(
        res: Response,
        message: string = 'Unauthorized'
    ): Response {
        return this.error(res, message, 401);
    }

    /**
     * Send a forbidden response (403)
     */
    static forbidden(
        res: Response,
        message: string = 'Forbidden'
    ): Response {
        return this.error(res, message, 403);
    }

    /**
     * Send a validation error response (400)
     */
    static validationError(
        res: Response,
        errors: any[],
        message: string = 'Validation failed'
    ): Response {
        return this.error(res, message, 400, errors);
    }
}
