import { Request, Response } from 'express';
import creditService from './credit.service';
import { ApiResponse } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/middleware/error.middleware';

class CreditController {
    /**
     * Get credit report for current user
     * GET /api/credit/report
     */
    getCreditReport = asyncHandler(async (req: Request, res: Response) => {
        const report = await creditService.getCreditReport(req.user!._id.toString());

        ApiResponse.success(res, { report }, 'Credit report retrieved successfully');
    });

    /**
     * Perform credit check for a loan amount
     * POST /api/credit/check
     */
    performCreditCheck = asyncHandler(async (req: Request, res: Response) => {
        const { amount } = req.body;

        const decision = await creditService.performCreditCheck(
            req.user!._id.toString(),
            amount
        );

        ApiResponse.success(res, { decision }, 'Credit check completed');
    });

    /**
     * Admin: Get credit report for any user
     * GET /api/admin/credit/:userId
     */
    getAdminCreditReport = asyncHandler(async (req: Request, res: Response) => {
        const report = await creditService.getCreditReport(req.params.userId);

        ApiResponse.success(res, { report }, 'Credit report retrieved successfully');
    });

    /**
     * Admin: Perform credit check for a user
     * POST /api/admin/credit/:userId/check
     */
    adminCreditCheck = asyncHandler(async (req: Request, res: Response) => {
        const { amount } = req.body;

        const decision = await creditService.performCreditCheck(
            req.params.userId,
            amount
        );

        ApiResponse.success(res, { decision }, 'Credit check completed');
    });
}

export default new CreditController();
