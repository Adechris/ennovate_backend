import mongoose from 'mongoose';
import Loan, { ILoan, LoanStatus } from './loan.model';
import { createAuditLog } from '../../shared/models/audit-log.model';
import {
    NotFoundError,
    ValidationError,
    InvalidStateTransitionError,
} from '../../shared/utils/app-error';
import notificationService from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.model';

interface CreateLoanInput {
    userId: string;
    amount: number;
    tenor: number;
    purpose: string;
    bankDetails: {
        accountNumber: string;
        bankName: string;
        accountName: string;
        bankCode: string;
    };
}

interface LoanQueryOptions {
    page?: number;
    limit?: number;
    status?: LoanStatus;
    userId?: string;
}

interface PaginatedResult<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

class LoanService {
    /**
     * Create a new loan application
     */
    async createLoan(input: CreateLoanInput): Promise<ILoan> {
        const { userId, amount, tenor, purpose } = input;

        // Check for existing active/pending loans (Single Active Loan Policy)
        const activeLoan = await Loan.findOne({
            userId: new mongoose.Types.ObjectId(userId),
            status: {
                $in: [
                    LoanStatus.PENDING,
                    LoanStatus.UNDER_REVIEW,
                    LoanStatus.APPROVED,
                    LoanStatus.ACTIVE,
                ],
            },
        });

        if (activeLoan) {
            throw new ValidationError(
                `You have an active loan (Status: ${activeLoan.status}). Please settle your outstanding balance before applying for a new one.`
            );
        }

        const loan = await Loan.create({
            userId: new mongoose.Types.ObjectId(userId),
            amount,
            tenor,
            purpose,
            bankDetails: input.bankDetails,
        });

        // Create audit log
        await createAuditLog({
            entityType: 'loan',
            entityId: loan._id,
            action: 'LOAN_APPLICATION_SUBMITTED',
            performedBy: new mongoose.Types.ObjectId(userId),
            newState: {
                amount,
                tenor,
                purpose,
                status: LoanStatus.PENDING,
            },
        });

        // Get user info for notification
        const User = (await import('../auth/user.model')).default;
        const user = await User.findById(userId);
        const userName = user ? `${user.firstName} ${user.lastName}` : 'A user';

        // Notify all admins about the new loan application
        await notificationService.notifyAllAdmins('admin_new_loan_application', {
            loanId: loan._id,
            applicationNumber: loan.applicationNumber,
            amount: loan.amount,
            userName,
        });

        return loan;
    }

    /**
     * Get loan by ID
     */
    async getLoanById(loanId: string, userId?: string): Promise<ILoan> {
        const query: Record<string, any> = { _id: loanId };

        // If userId is provided, ensure user owns the loan
        if (userId) {
            query.userId = userId;
        }

        const loan = await Loan.findOne(query)
            .populate('userId', 'firstName lastName email phone')
            .populate('statusHistory.performedBy', 'firstName lastName email')
            .populate('approvalDetails.approvedBy', 'firstName lastName email')
            .populate('rejectionDetails.rejectedBy', 'firstName lastName email')
            .populate('disbursement.disbursedBy', 'firstName lastName email');

        if (!loan) {
            throw new NotFoundError('Loan not found');
        }

        return loan;
    }

    /**
     * Get user's loans with pagination
     */
    async getUserLoans(
        userId: string,
        options: LoanQueryOptions = {}
    ): Promise<PaginatedResult<any>> {
        const { page = 1, limit = 10, status } = options;
        const skip = (page - 1) * limit;

        const query: Record<string, any> = { userId };
        if (status) {
            query.status = status;
        }

        const [loans, total] = await Promise.all([
            Loan.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Loan.countDocuments(query),
        ]);

        return {
            data: loans,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get all loans (admin) with pagination and filters
     */
    async getAllLoans(
        options: LoanQueryOptions = {}
    ): Promise<PaginatedResult<any>> {
        const { page = 1, limit = 10, status, userId } = options;
        const skip = (page - 1) * limit;

        const query: Record<string, any> = {};
        if (status) {
            query.status = status;
        }
        if (userId) {
            query.userId = userId;
        }

        const [loans, total] = await Promise.all([
            Loan.find(query)
                .populate('userId', 'firstName lastName email phone')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Loan.countDocuments(query),
        ]);

        return {
            data: loans,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Start review process for a loan (admin)
     */
    async startReview(loanId: string, adminId: string): Promise<ILoan> {
        const loan = await Loan.findById(loanId);

        if (!loan) {
            throw new NotFoundError('Loan not found');
        }

        if (loan.status !== LoanStatus.PENDING) {
            throw new InvalidStateTransitionError(loan.status, LoanStatus.UNDER_REVIEW);
        }

        const previousStatus = loan.status;
        loan.transitionTo(
            LoanStatus.UNDER_REVIEW,
            new mongoose.Types.ObjectId(adminId),
            'Loan picked up for review'
        );

        await loan.save();

        // Create audit log
        await createAuditLog({
            entityType: 'loan',
            entityId: loan._id,
            action: 'LOAN_REVIEW_STARTED',
            performedBy: new mongoose.Types.ObjectId(adminId),
            previousState: { status: previousStatus },
            newState: { status: loan.status },
        });

        return loan;
    }

    /**
     * Approve a loan (admin)
     */
    async approveLoan(
        loanId: string,
        adminId: string,
        approvedAmount?: number,
        conditions?: string[]
    ): Promise<ILoan> {
        const loan = await Loan.findById(loanId);

        if (!loan) {
            throw new NotFoundError('Loan not found');
        }

        if (loan.status === LoanStatus.APPROVED) {
            return loan;
        }

        if (loan.status !== LoanStatus.UNDER_REVIEW) {
            throw new InvalidStateTransitionError(loan.status, LoanStatus.APPROVED);
        }

        const finalAmount = approvedAmount || loan.amount;
        if (finalAmount > loan.amount) {
            throw new ValidationError('Approved amount cannot exceed requested amount');
        }

        const previousStatus = loan.status;
        loan.transitionTo(
            LoanStatus.APPROVED,
            new mongoose.Types.ObjectId(adminId),
            'Loan approved'
        );

        loan.approvalDetails = {
            approvedBy: new mongoose.Types.ObjectId(adminId),
            approvedAt: new Date(),
            approvedAmount: finalAmount,
            conditions,
        };

        // Recalculate if approved amount is different
        if (finalAmount !== loan.amount) {
            loan.amount = finalAmount;
            const annualRate = loan.interestRate;
            const tenor = loan.tenor;
            loan.totalInterest = Math.round(finalAmount * annualRate * (tenor / 12) * 100) / 100;
            loan.totalRepayable = Math.round((finalAmount + loan.totalInterest) * 100) / 100;
            loan.monthlyPayment = Math.round((loan.totalRepayable / tenor) * 100) / 100;
            loan.outstandingBalance = loan.totalRepayable;
        }

        await loan.save();

        // Create audit log
        await createAuditLog({
            entityType: 'loan',
            entityId: loan._id,
            action: 'LOAN_APPROVED',
            performedBy: new mongoose.Types.ObjectId(adminId),
            previousState: { status: previousStatus },
            newState: {
                status: loan.status,
                approvedAmount: finalAmount,
                conditions,
            },
        });

        // Send real-time notification to user
        await notificationService.sendNotification(
            loan.userId,
            NotificationType.LOAN_APPROVED,
            {
                loanId: loan._id,
                applicationNumber: loan.applicationNumber,
                amount: finalAmount,
            }
        );

        return loan;
    }

    /**
     * Reject a loan (admin)
     */
    async rejectLoan(
        loanId: string,
        adminId: string,
        reason: string
    ): Promise<ILoan> {
        const loan = await Loan.findById(loanId);

        if (!loan) {
            throw new NotFoundError('Loan not found');
        }

        if (loan.status === LoanStatus.REJECTED) {
            return loan;
        }

        if (loan.status !== LoanStatus.UNDER_REVIEW) {
            throw new InvalidStateTransitionError(loan.status, LoanStatus.REJECTED);
        }

        const previousStatus = loan.status;
        loan.transitionTo(
            LoanStatus.REJECTED,
            new mongoose.Types.ObjectId(adminId),
            reason
        );

        loan.rejectionDetails = {
            rejectedBy: new mongoose.Types.ObjectId(adminId),
            rejectedAt: new Date(),
            reason,
        };

        await loan.save();

        // Create audit log
        await createAuditLog({
            entityType: 'loan',
            entityId: loan._id,
            action: 'LOAN_REJECTED',
            performedBy: new mongoose.Types.ObjectId(adminId),
            previousState: { status: previousStatus },
            newState: { status: loan.status, reason },
        });

        // Send real-time notification to user
        await notificationService.sendNotification(
            loan.userId,
            NotificationType.LOAN_REJECTED,
            {
                loanId: loan._id,
                applicationNumber: loan.applicationNumber,
                reason,
            }
        );

        return loan;
    }

    /**
     * Get loan status history
     */
    async getLoanHistory(loanId: string, userId?: string): Promise<any[]> {
        const loan = await this.getLoanById(loanId, userId);
        return loan.statusHistory;
    }
}

export default new LoanService();
