import { Request, Response } from 'express';
import disbursementService from './disbursement.service';
import { ApiResponse } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/middleware/error.middleware';

class DisbursementController {
    /**
     * Disburse an approved loan (admin)
     * POST /api/admin/loans/:id/disburse
     */
    disburseLoan = asyncHandler(async (req: Request, res: Response) => {
        const result = await disbursementService.disburseLoan({
            loanId: req.params.id,
            adminId: req.user!._id.toString(),
        });

        ApiResponse.success(
            res,
            {
                loan: result.loan,
                disbursement: {
                    reference: result.disbursementRef,
                    providerReference: result.providerReference,
                    amount: result.amount,
                },
            },
            'Loan disbursed successfully'
        );
    });

    /**
     * Get disbursement details
     * GET /api/loans/:id/disbursement
     */
    getDisbursementDetails = asyncHandler(async (req: Request, res: Response) => {
        const details = await disbursementService.getDisbursementDetails(
            req.params.id
        );

        ApiResponse.success(res, details, 'Disbursement details retrieved');
    });
}

export default new DisbursementController();
