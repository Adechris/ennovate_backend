import mongoose from 'mongoose';
import Loan, { LoanStatus, ILoan } from '../loans/loan.model';
import Payment, { PaymentType, PaymentStatus, IPayment } from './payment.model';
import RepaymentSchedule, { ScheduleStatus } from './repayment-schedule.model';
import User from '../auth/user.model';
import { createAuditLog } from '../../shared/models/audit-log.model';
import { paymentProvider } from '../../shared/providers/payment-provider';
import { generateReference, roundToTwoDecimals } from '../../shared/utils/helpers';
import {
    NotFoundError,
    ValidationError,
    ConflictError,
    ConcurrencyError,
} from '../../shared/utils/app-error';
import notificationService from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.model';

interface RepaymentInput {
    loanId: string;
    userId: string;
    amount: number;
    idempotencyKey: string;
}

interface ManualRepaymentInput extends RepaymentInput {
    proofOfPayment?: string;
    evidenceUrl?: string;
    manualProof?: {
        senderBank?: string;
        senderName?: string;
        transferDate?: Date;
        externalReference?: string;
    };
}

interface VerifyRepaymentInput {
    paymentId: string;
    adminId: string;
    status: 'success' | 'failed';
    reason?: string;
}

interface RepaymentResult {
    payment: IPayment;
    loan: {
        totalRepaid: number;
        outstandingBalance: number;
        status: LoanStatus;
    };
    allocations: {
        scheduleId: string;
        installmentNumber: number;
        amountApplied: number;
    }[];
    overpayment?: number;
}

interface RefundInput {
    paymentId: string;
    adminId: string;
    reason: string;
    idempotencyKey: string;
}

class PaymentService {
    /**
     * Process a repayment for a loan
     * Uses optimistic locking to handle concurrent payments
     */
    async processRepayment(input: RepaymentInput): Promise<RepaymentResult> {
        const { loanId, userId, amount, idempotencyKey } = input;

        // Check for existing payment with same idempotency key
        const existingPayment = await Payment.findOne({ idempotencyKey });
        if (existingPayment) {
            if (existingPayment.status === PaymentStatus.SUCCESS) {
                // Return the existing successful payment
                const loan = await Loan.findById(loanId);
                return {
                    payment: existingPayment,
                    loan: {
                        totalRepaid: loan?.totalRepaid || 0,
                        outstandingBalance: loan?.outstandingBalance || 0,
                        status: loan?.status || LoanStatus.ACTIVE,
                    },
                    allocations: [],
                };
            }
            throw new ConflictError('Payment with this idempotency key is already being processed');
        }

        // Get loan and verify status
        const [loan, user] = await Promise.all([
            Loan.findOne({
                _id: loanId,
                userId,
                status: LoanStatus.ACTIVE,
            }),
            User.findById(userId),
        ]);

        if (!user) {
            throw new NotFoundError('User not found');
        }

        if (!loan) {
            const existingLoan = await Loan.findById(loanId);
            if (!existingLoan) {
                throw new NotFoundError('Loan not found');
            }
            if (existingLoan.userId.toString() !== userId) {
                throw new NotFoundError('Loan not found');
            }
            if (existingLoan.status !== LoanStatus.ACTIVE) {
                throw new ValidationError(`Cannot make repayment on loan with status: ${existingLoan.status}`);
            }
        }

        if (amount <= 0) {
            throw new ValidationError('Payment amount must be greater than 0');
        }

        // Create payment record
        const paymentReference = generateReference('PAY');
        const payment = await Payment.create({
            loanId: new mongoose.Types.ObjectId(loanId),
            userId: new mongoose.Types.ObjectId(userId),
            idempotencyKey,
            type: PaymentType.REPAYMENT,
            amount,
            reference: paymentReference,
            status: PaymentStatus.PROCESSING,
        });

        try {
            // Get outstanding installments (FIFO - oldest first)
            const outstandingSchedules = await RepaymentSchedule.find({
                loanId,
                status: { $in: [ScheduleStatus.PENDING, ScheduleStatus.PARTIAL, ScheduleStatus.OVERDUE] },
            }).sort({ installmentNumber: 1 });

            let remainingAmount = amount;
            const allocations: RepaymentResult['allocations'] = [];
            let overpayment = 0;

            // Allocate payment to installments
            for (const schedule of outstandingSchedules) {
                if (remainingAmount <= 0) break;

                const outstandingOnSchedule = roundToTwoDecimals(schedule.totalAmount - schedule.paidAmount);
                const amountToApply = Math.min(remainingAmount, outstandingOnSchedule);

                if (amountToApply > 0) {
                    schedule.paidAmount = roundToTwoDecimals(schedule.paidAmount + amountToApply);

                    if (schedule.paidAmount >= schedule.totalAmount) {
                        schedule.status = ScheduleStatus.PAID;
                        schedule.paidAt = new Date();
                    } else {
                        schedule.status = ScheduleStatus.PARTIAL;
                    }

                    await schedule.save();

                    allocations.push({
                        scheduleId: schedule._id.toString(),
                        installmentNumber: schedule.installmentNumber,
                        amountApplied: amountToApply,
                    });

                    remainingAmount = roundToTwoDecimals(remainingAmount - amountToApply);
                }
            }

            // Handle overpayment
            if (remainingAmount > 0) {
                overpayment = remainingAmount;
                // Store overpayment info in payment allocation
                payment.allocation = {
                    principal: amount - overpayment,
                    interest: 0,
                    overpayment,
                };
            }

            // Update loan balances with optimistic locking
            const currentVersion = loan!.__v;
            const newTotalRepaid = roundToTwoDecimals(loan!.totalRepaid + (amount - overpayment));
            const newOutstandingBalance = roundToTwoDecimals(loan!.totalRepayable - newTotalRepaid);

            const updatedLoan = await Loan.findOneAndUpdate(
                { _id: loanId, __v: currentVersion },
                {
                    $set: {
                        totalRepaid: newTotalRepaid,
                        outstandingBalance: newOutstandingBalance,
                    },
                    $inc: { __v: 1 },
                },
                { new: true }
            );

            if (!updatedLoan) {
                throw new ConcurrencyError('Loan was modified by another process. Please retry.');
            }

            // Check if loan is fully repaid
            if (newOutstandingBalance <= 0) {
                updatedLoan.status = LoanStatus.COMPLETED;
                updatedLoan.statusHistory.push({
                    fromStatus: LoanStatus.ACTIVE,
                    toStatus: LoanStatus.COMPLETED,
                    performedBy: new mongoose.Types.ObjectId(userId),
                    timestamp: new Date(),
                });
                await updatedLoan.save();

                // Send completion notification
                await notificationService.sendNotification(
                    updatedLoan.userId,
                    NotificationType.LOAN_COMPLETED,
                    {
                        loanId: updatedLoan._id,
                        applicationNumber: updatedLoan.applicationNumber,
                    }
                );
            }

            // Update payment status to success
            payment.status = PaymentStatus.SUCCESS;
            payment.reconciled = true;
            payment.reconciledAt = new Date();
            await payment.save();

            // Create audit log
            await createAuditLog({
                entityType: 'payment',
                entityId: payment._id,
                action: 'REPAYMENT_PROCESSED',
                performedBy: new mongoose.Types.ObjectId(userId),
                newState: {
                    amount,
                    reference: paymentReference,
                    allocations,
                    overpayment,
                },
            });

            // Send notification
            await notificationService.sendNotification(
                new mongoose.Types.ObjectId(userId),
                NotificationType.PAYMENT_RECEIVED,
                {
                    loanId: updatedLoan._id,
                    amount,
                    reference: paymentReference,
                }
            );

            // Notify Admins
            const admins = await User.find({ role: 'admin' });
            for (const admin of admins) {
                await notificationService.sendNotification(
                    admin._id,
                    NotificationType.PAYMENT_RECEIVED,
                    {
                        loanId: updatedLoan._id,
                        userId: new mongoose.Types.ObjectId(userId),
                        amount,
                        reference: paymentReference,
                        userName: `${user.firstName} ${user.lastName}`,
                        isAdmin: true,
                        applicationNumber: updatedLoan.applicationNumber
                    }
                );
            }

            return {
                payment,
                loan: {
                    totalRepaid: newTotalRepaid,
                    outstandingBalance: newOutstandingBalance,
                    status: updatedLoan.status,
                },
                allocations,
                overpayment: overpayment > 0 ? overpayment : undefined,
            };
        } catch (error) {
            // Mark payment as failed
            payment.status = PaymentStatus.FAILED;
            payment.failureReason = error instanceof Error ? error.message : 'Unknown error';
            await payment.save();

            throw error;
        }
    }

    /**
     * Get repayment schedule for a loan
     */
    async getRepaymentSchedule(loanId: string, userId?: string): Promise<any[]> {
        // Verify user owns the loan if userId provided
        if (userId) {
            const loan = await Loan.findOne({ _id: loanId, userId });
            if (!loan) {
                throw new NotFoundError('Loan not found');
            }
        }

        const schedules = await RepaymentSchedule.find({ loanId })
            .sort({ installmentNumber: 1 })
            .lean();

        return schedules;
    }

    /**
     * Get payment history for a loan
     */
    async getPaymentHistory(loanId: string, userId?: string): Promise<any[]> {
        const query: Record<string, any> = {
            loanId,
            status: PaymentStatus.SUCCESS,
        };

        if (userId) {
            query.userId = userId;
        }

        const payments = await Payment.find(query)
            .sort({ createdAt: -1 })
            .lean();

        return payments;
    }

    /**
     * Get user's all payments
     */
    async getUserPayments(
        userId: string,
        options: { page?: number; limit?: number } = {}
    ): Promise<{ payments: any[]; total: number }> {
        const { page = 1, limit = 20 } = options;
        const skip = (page - 1) * limit;

        const [payments, total] = await Promise.all([
            Payment.find({ userId })
                .populate('loanId', 'applicationNumber')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Payment.countDocuments({ userId }),
        ]);

        return { payments, total };
    }

    /**
     * Process a refund (admin)
     */
    async processRefund(input: RefundInput): Promise<IPayment> {
        const { paymentId, adminId, reason, idempotencyKey } = input;

        // Check idempotency
        const existingRefund = await Payment.findOne({ idempotencyKey });
        if (existingRefund) {
            return existingRefund;
        }

        // Get original payment
        const originalPayment = await Payment.findById(paymentId);
        if (!originalPayment) {
            throw new NotFoundError('Payment not found');
        }

        if (originalPayment.status !== PaymentStatus.SUCCESS) {
            throw new ValidationError('Can only refund successful payments');
        }

        // Create refund payment
        const refundReference = generateReference('RFD');
        const refund = await Payment.create({
            loanId: originalPayment.loanId,
            userId: originalPayment.userId,
            idempotencyKey,
            type: PaymentType.REFUND,
            amount: originalPayment.amount,
            reference: refundReference,
            status: PaymentStatus.PROCESSING,
        });

        try {
            // Call payment provider to process refund
            const refundResult = await paymentProvider.transfer({
                amount: originalPayment.amount,
                accountNumber: '0000000000', // Would come from user's saved account
                bankCode: '000',
                narration: `Refund for payment ${originalPayment.reference}`,
                reference: refundReference,
            });

            if (refundResult.success) {
                refund.status = PaymentStatus.SUCCESS;
                refund.providerReference = refundResult.providerReference;
                refund.reconciled = true;
                refund.reconciledAt = new Date();

                // Update loan balance
                await Loan.findByIdAndUpdate(originalPayment.loanId, {
                    $inc: {
                        totalRepaid: -originalPayment.amount,
                        outstandingBalance: originalPayment.amount,
                    },
                });

                // Send notification
                await notificationService.sendNotification(
                    originalPayment.userId,
                    NotificationType.REFUND_PROCESSED,
                    {
                        amount: originalPayment.amount,
                        reference: refundReference,
                    }
                );
            } else {
                refund.status = PaymentStatus.FAILED;
                refund.failureReason = refundResult.message;
            }

            await refund.save();

            // Create audit log
            await createAuditLog({
                entityType: 'payment',
                entityId: refund._id,
                action: 'REFUND_PROCESSED',
                performedBy: new mongoose.Types.ObjectId(adminId),
                previousState: { originalPaymentId: paymentId },
                newState: {
                    amount: originalPayment.amount,
                    reference: refundReference,
                    status: refund.status,
                    reason,
                },
            });

            return refund;
        } catch (error) {
            refund.status = PaymentStatus.FAILED;
            refund.failureReason = error instanceof Error ? error.message : 'Unknown error';
            await refund.save();
            throw error;
        }
    }

    /**
     * Refund overpayment (admin)
     * This refunds ONLY the excess amount and does NOT add debt back to the loan.
     */
    async refundOverpayment(input: RefundInput & { amount?: number }): Promise<IPayment> {
        const { paymentId, adminId, reason, idempotencyKey, amount } = input;

        // Check idempotency
        const existingRefund = await Payment.findOne({ idempotencyKey });
        if (existingRefund) {
            return existingRefund;
        }

        // Get original payment
        const originalPayment = await Payment.findById(paymentId);
        if (!originalPayment) {
            throw new NotFoundError('Payment not found');
        }

        if (originalPayment.status !== PaymentStatus.SUCCESS) {
            throw new ValidationError('Can only refund successful payments');
        }

        let refundAmount = 0;

        if (amount && amount > 0) {
            // Manual override
            if (amount > originalPayment.amount) {
                throw new ValidationError('Refund amount cannot exceed original payment amount');
            }
            refundAmount = amount;
        } else {
            // Auto-detect
            const overpayment = originalPayment.allocation?.overpayment || 0;
            if (overpayment <= 0) {
                throw new ValidationError('This payment has no recorded overpayment. Please specify an amount.');
            }
            refundAmount = overpayment;
        }

        if (originalPayment.isOverpaymentRefunded) {
            throw new ConflictError('Overpayment for this transaction has already been refunded');
        }

        // Create refund payment record
        const refundReference = generateReference('RFD');
        const refund = await Payment.create({
            loanId: originalPayment.loanId,
            userId: originalPayment.userId,
            idempotencyKey,
            type: PaymentType.REFUND, // Mark as refund
            amount: refundAmount, // Only refund the excess
            reference: refundReference,
            status: PaymentStatus.PROCESSING,
            proofOfPayment: reason || 'Overpayment Refund',
        });

        try {
            // Process transfer via provider
            const refundResult = await paymentProvider.transfer({
                amount: refundAmount,
                accountNumber: '0000000000', // Mock: User's saved account
                bankCode: '000',
                narration: `Refund Excess: ${originalPayment.reference}`,
                reference: refundReference,
            });

            if (refundResult.success) {
                refund.status = PaymentStatus.SUCCESS;
                refund.providerReference = refundResult.providerReference;
                refund.reconciled = true;
                refund.reconciledAt = new Date();
                refund.verifiedBy = new mongoose.Types.ObjectId(adminId);
                refund.verifiedAt = new Date();

                // Mark original payment as refunded
                originalPayment.isOverpaymentRefunded = true;
                await originalPayment.save();

                // NOTE: We do NOT increase loan balance here because this money was never applied to the debt.
            } else {
                refund.status = PaymentStatus.FAILED;
                refund.failureReason = refundResult.message;
            }

            await refund.save();

            if (refund.status === PaymentStatus.SUCCESS) {
                // Send notification
                await notificationService.sendNotification(
                    originalPayment.userId,
                    NotificationType.REFUND_PROCESSED,
                    {
                        loanId: originalPayment.loanId,
                        amount: refundAmount,
                        reference: refundReference,
                    }
                );

                // Audit log
                await createAuditLog({
                    entityType: 'payment',
                    entityId: refund._id,
                    action: 'OVERPAYMENT_REFUNDED',
                    performedBy: new mongoose.Types.ObjectId(adminId),
                    previousState: { originalPaymentId: paymentId },
                    newState: {
                        amount: refundAmount,
                        reference: refundReference,
                        status: 'success',
                        reason,
                    },
                });
            }

            return refund;
        } catch (error) {
            refund.status = PaymentStatus.FAILED;
            refund.failureReason = error instanceof Error ? error.message : 'Unknown error';
            await refund.save();
            throw error;
        }
    }

    /**
     * Submit a manual repayment with proof
     */
    async submitManualRepayment(input: ManualRepaymentInput): Promise<IPayment> {
        const { loanId, userId, amount, idempotencyKey, proofOfPayment, evidenceUrl } = input;

        // Check for existing payment
        const existingPayment = await Payment.findOne({ idempotencyKey });
        if (existingPayment) {
            return existingPayment;
        }

        // Verify loan exists and is active
        const loan = await Loan.findOne({ _id: loanId, userId, status: LoanStatus.ACTIVE });
        if (!loan) {
            throw new NotFoundError('Active loan not found');
        }

        // Create pending payment
        const paymentReference = generateReference('MAN');
        const payment = await Payment.create({
            loanId: new mongoose.Types.ObjectId(loanId),
            userId: new mongoose.Types.ObjectId(userId),
            idempotencyKey,
            type: PaymentType.REPAYMENT,
            amount,
            reference: paymentReference,
            status: PaymentStatus.PENDING,
            proofOfPayment,
            evidenceUrl,
            manualProof: input.manualProof,
        });

        // Notify Admins about new proof
        const admins = await User.find({ role: 'admin' });
        const user = await User.findById(userId);
        for (const admin of admins) {
            await notificationService.sendNotification(
                admin._id,
                NotificationType.PAYMENT_RECEIVED,
                {
                    loanId: loan._id,
                    userId: new mongoose.Types.ObjectId(userId),
                    amount,
                    reference: paymentReference,
                    userName: `${user?.firstName} ${user?.lastName}`,
                    isAdmin: true,
                    applicationNumber: loan.applicationNumber,
                    isManual: true,
                    proofOfPayment
                }
            );
        }

        return payment;
    }

    /**
     * Verify a manual repayment (Admin)
     */
    async verifyRepayment(input: VerifyRepaymentInput): Promise<RepaymentResult | { payment: IPayment }> {
        const { paymentId, adminId, status, reason } = input;

        const payment = await Payment.findById(paymentId);
        if (!payment) {
            throw new NotFoundError('Payment not found');
        }

        if (payment.status !== PaymentStatus.PENDING) {
            throw new ValidationError(`Payment is already ${payment.status}`);
        }

        if (status === 'failed') {
            payment.status = PaymentStatus.FAILED;
            payment.failureReason = reason || 'Admin rejected proof';
            payment.verifiedBy = new mongoose.Types.ObjectId(adminId);
            payment.verifiedAt = new Date();
            await payment.save();

            // Notify user about rejection
            await notificationService.sendNotification(
                payment.userId,
                NotificationType.PAYMENT_RECEIVED, // We can reuse or add a REJECTED type if needed, but let's keep it simple
                {
                    loanId: payment.loanId,
                    amount: payment.amount,
                    reference: payment.reference,
                    status: 'rejected',
                    reason: payment.failureReason
                }
            );

            return { payment };
        }

        // status === 'success' -> Approve and process
        const loan = await Loan.findById(payment.loanId);
        if (!loan || loan.status !== LoanStatus.ACTIVE) {
            throw new ValidationError('Loan is no longer active');
        }

        // Process actual repayment logic (similar to processRepayment but without creating new payment)
        // Get outstanding installments (FIFO)
        const outstandingSchedules = await RepaymentSchedule.find({
            loanId: loan._id,
            status: { $in: [ScheduleStatus.PENDING, ScheduleStatus.PARTIAL, ScheduleStatus.OVERDUE] },
        }).sort({ installmentNumber: 1 });

        let remainingAmount = payment.amount;
        const allocations: RepaymentResult['allocations'] = [];
        let overpayment = 0;

        for (const schedule of outstandingSchedules) {
            if (remainingAmount <= 0) break;
            const outstandingOnSchedule = roundToTwoDecimals(schedule.totalAmount - schedule.paidAmount);
            const amountToApply = Math.min(remainingAmount, outstandingOnSchedule);

            if (amountToApply > 0) {
                schedule.paidAmount = roundToTwoDecimals(schedule.paidAmount + amountToApply);
                schedule.status = schedule.paidAmount >= schedule.totalAmount ? ScheduleStatus.PAID : ScheduleStatus.PARTIAL;
                if (schedule.status === ScheduleStatus.PAID) schedule.paidAt = new Date();
                await schedule.save();
                allocations.push({
                    scheduleId: schedule._id.toString(),
                    installmentNumber: schedule.installmentNumber,
                    amountApplied: amountToApply,
                });
                remainingAmount = roundToTwoDecimals(remainingAmount - amountToApply);
            }
        }

        if (remainingAmount > 0) {
            overpayment = remainingAmount;
            payment.allocation = { principal: payment.amount - overpayment, interest: 0, overpayment };
        } else {
            payment.allocation = { principal: payment.amount, interest: 0, overpayment: 0 };
        }

        const newTotalRepaid = roundToTwoDecimals(loan.totalRepaid + (payment.amount - overpayment));
        const newOutstandingBalance = roundToTwoDecimals(loan.totalRepayable - newTotalRepaid);

        const updatedLoan = await Loan.findOneAndUpdate(
            { _id: loan._id, __v: loan.__v },
            {
                $set: { totalRepaid: newTotalRepaid, outstandingBalance: newOutstandingBalance },
                $inc: { __v: 1 },
            },
            { new: true }
        );

        if (!updatedLoan) throw new ConcurrencyError('Loan modified by another process');

        if (newOutstandingBalance <= 0) {
            updatedLoan.status = LoanStatus.COMPLETED;
            await updatedLoan.save();
            await notificationService.sendNotification(updatedLoan.userId, NotificationType.LOAN_COMPLETED, {
                loanId: updatedLoan._id,
                applicationNumber: updatedLoan.applicationNumber,
            });
        }

        payment.status = PaymentStatus.SUCCESS;
        payment.reconciled = true;
        payment.reconciledAt = new Date();
        payment.verifiedBy = new mongoose.Types.ObjectId(adminId);
        payment.verifiedAt = new Date();
        await payment.save();

        // Audit Log
        await createAuditLog({
            entityType: 'payment',
            entityId: payment._id,
            action: 'MANUAL_REPAYMENT_VERIFIED',
            performedBy: new mongoose.Types.ObjectId(adminId),
            newState: { status: 'success', amount: payment.amount, allocations }
        });

        // Notify user
        await notificationService.sendNotification(payment.userId, NotificationType.PAYMENT_RECEIVED, {
            loanId: loan._id,
            amount: payment.amount,
            reference: payment.reference,
            status: 'approved'
        });

        return {
            payment,
            loan: {
                totalRepaid: newTotalRepaid,
                outstandingBalance: newOutstandingBalance,
                status: updatedLoan.status,
            },
            allocations,
            overpayment: overpayment > 0 ? overpayment : undefined,
        };
    }

    /**
     * Get all payments across the system (admin)
     */
    async getAllPayments(
        options: { page?: number; limit?: number; status?: string; type?: string } = {}
    ): Promise<{ payments: any[]; total: number }> {
        const { page = 1, limit = 20, status, type } = options;
        const skip = (page - 1) * limit;

        const query: Record<string, any> = {};
        if (status) query.status = status;
        if (type) query.type = type;

        const [payments, total] = await Promise.all([
            Payment.find(query)
                .populate('userId', 'firstName lastName email')
                .populate('loanId', 'applicationNumber')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Payment.countDocuments(query),
        ]);

        return { payments, total };
    }
}

export default new PaymentService();
