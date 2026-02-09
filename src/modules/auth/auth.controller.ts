import { Request, Response } from 'express';
import authService from './auth.service';
import { ApiResponse } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/middleware/error.middleware';

class AuthController {
    /**
     * Register a new user
     * POST /api/auth/register
     */
    register = asyncHandler(async (req: Request, res: Response) => {
        const { email, password, firstName, lastName, phone, bvn } = req.body;

        const result = await authService.register({
            email,
            password,
            firstName,
            lastName,
            phone,
            bvn,
        });

        ApiResponse.created(res, result, 'Registration successful');
    });

    /**
     * Register a new admin
     * POST /api/admin/auth/register
     */
    adminRegister = asyncHandler(async (req: Request, res: Response) => {
        const { email, password, firstName, lastName, phone, bvn, adminSecret } = req.body;

        const result = await authService.adminRegister({
            email,
            password,
            firstName,
            lastName,
            phone,
            bvn,
            adminSecret,
        });

        ApiResponse.created(res, result, 'Admin registration successful');
    });

    /**
     * Login user
     * POST /api/auth/login
     */
    login = asyncHandler(async (req: Request, res: Response) => {
        const { email, password } = req.body;

        const result = await authService.login({ email, password });

        ApiResponse.success(res, result, 'Login successful');
    });

    /**
     * Login admin
     * POST /api/admin/auth/login
     */
    adminLogin = asyncHandler(async (req: Request, res: Response) => {
        const { email, password } = req.body;

        const result = await authService.adminLogin({ email, password });

        ApiResponse.success(res, result, 'Admin login successful');
    });

    /**
     * Get current user profile
     * GET /api/auth/me
     */
    getProfile = asyncHandler(async (req: Request, res: Response) => {
        const user = await authService.getProfile(req.user!._id.toString());

        ApiResponse.success(res, { user }, 'Profile retrieved successfully');
    });

    /**
     * Update user profile
     * PUT /api/auth/profile
     */
    updateProfile = asyncHandler(async (req: Request, res: Response) => {
        const { firstName, lastName, phone, bvn } = req.body;

        const user = await authService.updateProfile(req.user!._id.toString(), {
            firstName,
            lastName,
            phone,
            bvn,
        });

        ApiResponse.success(res, { user }, 'Profile updated successfully');
    });
}

export default new AuthController();
