import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IUser } from '../../modules/auth/user.model';
import User from '../../modules/auth/user.model';
import { AuthenticationError } from '../utils/app-error';

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: IUser;
        }
    }
}

interface JwtPayload {
    id: string;
    email: string;
    role: string;
    iat: number;
    exp: number;
}

/**
 * Middleware to protect routes - verifies JWT token
 */
export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // 1. Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AuthenticationError('No token provided. Please login.');
        }

        const token = authHeader.split(' ')[1];

        // 2. Verify token
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is not defined');
        }

        const decoded = jwt.verify(token, jwtSecret) as JwtPayload;

        // 3. Check if user still exists
        const user = await User.findById(decoded.id);

        if (!user) {
            throw new AuthenticationError('User no longer exists');
        }

        if (!user.isActive) {
            throw new AuthenticationError('User account is deactivated');
        }

        // 4. Attach user to request
        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            next(new AuthenticationError('Invalid token. Please login again.'));
        } else if (error instanceof jwt.TokenExpiredError) {
            next(new AuthenticationError('Token expired. Please login again.'));
        } else {
            next(error);
        }
    }
};

/**
 * Generate JWT token for a user
 */
export const generateToken = (user: IUser): string => {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error('JWT_SECRET is not defined');
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

    return jwt.sign(
        {
            id: user._id,
            email: user.email,
            role: user.role,
        },
        jwtSecret,
        {
            expiresIn,
        } as jwt.SignOptions
    );
};
