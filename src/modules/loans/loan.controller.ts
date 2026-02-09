import { Request, Response } from 'express';
import loanService from './loan.service';
import { ApiResponse } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/middleware/error.middleware';
import { LoanStatus } from './loan.model';

class LoanController {
    /**
     * Submit a new loan application
     * POST /api/loans
     */
    createLoan = asyncHandler(async (req: Request, res: Response) => {
        const { amount, tenor, purpose, bankDetails } = req.body;

        const loan = await loanService.createLoan({
            userId: req.user!._id.toString(),
            amount,
            tenor,
            purpose,
            bankDetails,
        });

        ApiResponse.created(res, { loan }, 'Loan application submitted successfully');
    });

    /**
     * Get user's loans
     * GET /api/loans
     */
    getMyLoans = asyncHandler(async (req: Request, res: Response) => {
        const { page, limit, status } = req.query;

        const result = await loanService.getUserLoans(req.user!._id.toString(), {
            page: page ? parseInt(page as string) : 1,
            limit: limit ? parseInt(limit as string) : 10,
            status: status as LoanStatus | undefined,
        });

        ApiResponse.success(
            res,
            { loans: result.data },
            'Loans retrieved successfully',
            200,
            result.pagination
        );
    });

    /**
     * Get single loan details
     * GET /api/loans/:id
     */
    getLoan = asyncHandler(async (req: Request, res: Response) => {
        const loan = await loanService.getLoanById(
            req.params.id,
            req.user!._id.toString()
        );

        ApiResponse.success(res, { loan }, 'Loan details retrieved successfully');
    });

    /**
     * Get loan status history
     * GET /api/loans/:id/history
     */
    getLoanHistory = asyncHandler(async (req: Request, res: Response) => {
        const history = await loanService.getLoanHistory(
            req.params.id,
            req.user!._id.toString()
        );

        ApiResponse.success(res, { history }, 'Loan history retrieved successfully');
    });

    // ============ ADMIN ENDPOINTS ============

    /**
     * Get all loans (admin)
     * GET /api/admin/loans
     */
    getAllLoans = asyncHandler(async (req: Request, res: Response) => {
        const { page, limit, status, userId } = req.query;

        const result = await loanService.getAllLoans({
            page: page ? parseInt(page as string) : 1,
            limit: limit ? parseInt(limit as string) : 10,
            status: status as LoanStatus | undefined,
            userId: userId as string | undefined,
        });

        ApiResponse.success(
            res,
            { loans: result.data },
            'Loans retrieved successfully',
            200,
            result.pagination
        );
    });

    /**
     * Get any loan details (admin)
     * GET /api/admin/loans/:id
     */
    getAnyLoan = asyncHandler(async (req: Request, res: Response) => {
        const loan = await loanService.getLoanById(req.params.id);

        ApiResponse.success(res, { loan }, 'Loan details retrieved successfully');
    });

    /**
     * Start loan review (admin)
     * POST /api/admin/loans/:id/review
     */
    startReview = asyncHandler(async (req: Request, res: Response) => {
        const loan = await loanService.startReview(
            req.params.id,
            req.user!._id.toString()
        );

        ApiResponse.success(res, { loan }, 'Loan review started');
    });

    /**
     * Approve loan (admin)
     * POST /api/admin/loans/:id/approve
     */
    approveLoan = asyncHandler(async (req: Request, res: Response) => {
        const { approvedAmount, conditions } = req.body;

        const loan = await loanService.approveLoan(
            req.params.id,
            req.user!._id.toString(),
            approvedAmount,
            conditions
        );

        ApiResponse.success(res, { loan }, 'Loan approved successfully');
    });

    /**
     * Reject loan (admin)
     * POST /api/admin/loans/:id/reject
     */
    rejectLoan = asyncHandler(async (req: Request, res: Response) => {
        const { reason } = req.body;

        const loan = await loanService.rejectLoan(
            req.params.id,
            req.user!._id.toString(),
            reason
        );

        ApiResponse.success(res, { loan }, 'Loan rejected');
    });
}

export default new LoanController();
