// Custom error class for application errors
export class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;
    code?: string;

    constructor(message: string, statusCode: number, code?: string) {
        super(message);

        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        this.code = code;

        Error.captureStackTrace(this, this.constructor);
    }
}

// Specific error types
export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication failed') {
        super(message, 401, 'AUTHENTICATION_ERROR');
    }
}

export class AuthorizationError extends AppError {
    constructor(message: string = 'Not authorized to perform this action') {
        super(message, 403, 'AUTHORIZATION_ERROR');
    }
}

export class NotFoundError extends AppError {
    constructor(message: string = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
    }
}

export class ConflictError extends AppError {
    constructor(message: string = 'Resource already exists') {
        super(message, 409, 'CONFLICT');
    }
}

export class ConcurrencyError extends AppError {
    constructor(message: string = 'Resource was modified by another process') {
        super(message, 409, 'CONCURRENCY_ERROR');
    }
}

export class InvalidStateTransitionError extends AppError {
    constructor(currentState: string, targetState: string) {
        super(
            `Invalid state transition from '${currentState}' to '${targetState}'`,
            400,
            'INVALID_STATE_TRANSITION'
        );
    }
}

export class IdempotencyError extends AppError {
    constructor(message: string = 'Duplicate request detected') {
        super(message, 409, 'IDEMPOTENCY_ERROR');
    }
}
