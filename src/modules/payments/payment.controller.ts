import { Request, Response } from 'express';
import paymentService from './payment.service';
import { ApiResponse } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/middleware/error.middleware';
import { ValidationError } from '../../shared/utils/app-error';

class PaymentController {
    /**
     * Make a repayment on a loan
     * POST /api/loans/:id/repay
     */
    makeRepayment = asyncHandler(async (req: Request, res: Response) => {
        const { amount } = req.body;
        const idempotencyKey = req.headers['idempotency-key'] as string;

        const result = await paymentService.processRepayment({
            loanId: req.params.id,
            userId: req.user!._id.toString(),
            amount,
            idempotencyKey: idempotencyKey || `${req.user!._id}-${Date.now()}`,
        });

        ApiResponse.success(
            res,
            {
                payment: result.payment,
                loan: result.loan,
                allocations: result.allocations,
                overpayment: result.overpayment,
            },
            result.overpayment
                ? `Payment processed. Note: ${result.overpayment} was overpaid.`
                : 'Payment processed successfully'
        );
    });

    /**
     * Get repayment schedule for a loan
     * GET /api/loans/:id/schedule
     */
    getRepaymentSchedule = asyncHandler(async (req: Request, res: Response) => {
        const schedule = await paymentService.getRepaymentSchedule(
            req.params.id,
            req.user!._id.toString()
        );

        ApiResponse.success(res, { schedule }, 'Repayment schedule retrieved');
    });

    /**
     * Get payment history for a loan
     * GET /api/loans/:id/payments
     */
    getLoanPayments = asyncHandler(async (req: Request, res: Response) => {
        const payments = await paymentService.getPaymentHistory(
            req.params.id,
            req.user!._id.toString()
        );

        ApiResponse.success(res, { payments }, 'Payment history retrieved');
    });

    /**
     * Get all user payments
     * GET /api/payments
     */
    getMyPayments = asyncHandler(async (req: Request, res: Response) => {
        const { page, limit } = req.query;

        const result = await paymentService.getUserPayments(
            req.user!._id.toString(),
            {
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 20,
            }
        );

        ApiResponse.success(
            res,
            { payments: result.payments },
            'Payments retrieved',
            200,
            {
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 20,
                total: result.total,
                totalPages: Math.ceil(result.total / (limit ? parseInt(limit as string) : 20)),
            }
        );
    });

    // ============ ADMIN ENDPOINTS ============

    /**
     * Process a refund (admin)
     * POST /api/admin/payments/:id/refund
     */
    processRefund = asyncHandler(async (req: Request, res: Response) => {
        const { reason } = req.body;
        const idempotencyKey = req.headers['idempotency-key'] as string;

        const refund = await paymentService.processRefund({
            paymentId: req.params.id,
            adminId: req.user!._id.toString(),
            reason,
            idempotencyKey: idempotencyKey || `refund-${req.params.id}-${Date.now()}`,
        });

        ApiResponse.success(res, { refund }, 'Refund processed');
    });

    /**
     * Process an overpayment refund (admin)
     * POST /api/admin/payments/:id/refund-overpayment
     */
    refundOverpayment = asyncHandler(async (req: Request, res: Response) => {
        const { reason, amount } = req.body;
        const idempotencyKey = req.headers['idempotency-key'] as string;

        const refund = await paymentService.refundOverpayment({
            paymentId: req.params.id,
            adminId: req.user!._id.toString(),
            reason,
            amount: amount ? parseFloat(amount) : undefined,
            idempotencyKey: idempotencyKey || `refund-overpayment-${req.params.id}-${Date.now()}`,
        });

        ApiResponse.success(res, { refund }, 'Overpayment refund processed successfully');
    });

    /**
     * Get repayment schedule for any loan (admin)
     * GET /api/admin/loans/:id/schedule
     */
    getAdminRepaymentSchedule = asyncHandler(async (req: Request, res: Response) => {
        const schedule = await paymentService.getRepaymentSchedule(req.params.id);

        ApiResponse.success(res, { schedule }, 'Repayment schedule retrieved');
    });

    /**
     * Get payment history for any loan (admin)
     * GET /api/admin/loans/:id/payments
     */
    getAdminLoanPayments = asyncHandler(async (req: Request, res: Response) => {
        const payments = await paymentService.getPaymentHistory(req.params.id);

        ApiResponse.success(res, { payments }, 'Payment history retrieved');
    });

    /**
     * Submit manual repayment with proof
     * POST /api/payments/manual
     */
    submitManualRepayment = asyncHandler(async (req: Request, res: Response) => {
        const { loanId, amount, proofOfPayment, evidenceUrl } = req.body;
        const idempotencyKey = req.headers['idempotency-key'] as string;

        const payment = await paymentService.submitManualRepayment({
            loanId,
            userId: req.user!._id.toString(),
            amount,
            idempotencyKey: idempotencyKey || `manual-${req.user!._id}-${Date.now()}`,
            proofOfPayment,
            evidenceUrl,
        });

        ApiResponse.success(res, { payment }, 'Manual repayment submitted for verification', 201);
    });

    /**
     * Submit manual repayment with structured proof and receipt upload
     * POST /api/payments/manual-with-receipt
     */
    submitManualRepaymentWithReceipt = asyncHandler(async (req: Request, res: Response) => {
        const { loanId, amount, senderBank, senderName, transferDate, externalReference } = req.body;
        const idempotencyKey = req.headers['idempotency-key'] as string;

        if (!req.file) {
            throw new ValidationError('Repayment receipt image is required');
        }

        const evidenceUrl = `${req.protocol}://${req.get('host')}/uploads/receipts/${req.file.filename}`;

        const payment = await paymentService.submitManualRepayment({
            loanId,
            userId: req.user!._id.toString(),
            amount: parseFloat(amount),
            idempotencyKey: idempotencyKey || `manual-upload-${req.user!._id}-${Date.now()}`,
            evidenceUrl,
            manualProof: {
                senderBank,
                senderName,
                transferDate: transferDate ? new Date(transferDate) : new Date(),
                externalReference,
            },
        });

        ApiResponse.success(res, { payment }, 'Repayment proof uploaded successfully', 201);
    });

    /**
     * Verify manual repayment (admin)
     * POST /api/admin/payments/:id/verify
     */
    verifyRepayment = asyncHandler(async (req: Request, res: Response) => {
        const { status, reason } = req.body;

        const result = await paymentService.verifyRepayment({
            paymentId: req.params.id,
            adminId: req.user!._id.toString(),
            status,
            reason,
        });

        ApiResponse.success(res, result, `Repayment ${status === 'success' ? 'verified' : 'rejected'} successfully`);
    });

    /**
     * Get all payments (admin)
     * GET /api/admin/payments
     */
    getAllPayments = asyncHandler(async (req: Request, res: Response) => {
        const { page, limit, status, type } = req.query;

        const result = await paymentService.getAllPayments({
            page: page ? parseInt(page as string) : 1,
            limit: limit ? parseInt(limit as string) : 20,
            status: status as string,
            type: type as string,
        });

        ApiResponse.success(
            res,
            { payments: result.payments },
            'All payments retrieved',
            200,
            {
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 20,
                total: result.total,
                totalPages: Math.ceil(result.total / (limit ? parseInt(limit as string) : 20)),
            }
        );
    });
}

export default new PaymentController();
