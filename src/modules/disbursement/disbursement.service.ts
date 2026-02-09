import mongoose from 'mongoose';
import Loan, { LoanStatus, ILoan } from '../loans/loan.model';
import RepaymentSchedule, { ScheduleStatus } from '../payments/repayment-schedule.model';
import { createAuditLog } from '../../shared/models/audit-log.model';
import { paymentProvider } from '../../shared/providers/payment-provider';
import { generateReference, addMonths, roundToTwoDecimals } from '../../shared/utils/helpers';
import {
    NotFoundError,
    InvalidStateTransitionError,
    ConflictError,
    AppError,
} from '../../shared/utils/app-error';
import notificationService from '../notifications/notification.service';
import { NotificationType } from '../notifications/notification.model';

interface DisbursementInput {
    loanId: string;
    adminId: string;
}

interface DisbursementResult {
    loan: ILoan;
    disbursementRef: string;
    providerReference?: string;
    amount: number;
}

class DisbursementService {
    /**
     * Disburse an approved loan
     * Uses atomic operations to prevent double disbursement
     */
    async disburseLoan(input: DisbursementInput): Promise<DisbursementResult> {
        const { loanId, adminId } = input;

        // Fetch loan to get bank details
        const initialLoan = await Loan.findById(loanId);
        if (!initialLoan) {
            throw new NotFoundError('Loan not found');
        }

        if (!initialLoan.bankDetails) {
            throw new AppError('Bank details missing for this loan', 400);
        }

        const { accountNumber, bankCode } = initialLoan.bankDetails;

        // Generate unique disbursement reference
        const disbursementRef = generateReference('DSB');

        // Atomically update loan status from approved to disbursed
        // This prevents race conditions where multiple disbursements could happen
        const loan = await Loan.findOneAndUpdate(
            {
                _id: loanId,
                status: LoanStatus.APPROVED,
                'disbursement.disbursementRef': { $exists: false },
            },
            {
                $set: {
                    status: LoanStatus.DISBURSED,
                    'disbursement.disbursementRef': disbursementRef,
                    'disbursement.disbursedBy': new mongoose.Types.ObjectId(adminId),
                    'disbursement.disbursedAt': new Date(),
                    'disbursement.bankAccount': accountNumber,
                    'disbursement.bankCode': bankCode,
                },
                $push: {
                    statusHistory: {
                        fromStatus: LoanStatus.APPROVED,
                        toStatus: LoanStatus.DISBURSED,
                        reason: 'Loan disbursed',
                        performedBy: new mongoose.Types.ObjectId(adminId),
                        timestamp: new Date(),
                    },
                },
            },
            { new: true }
        );

        if (!loan) {
            // Check if loan exists and why it wasn't updated
            const existingLoan = await Loan.findById(loanId);

            if (!existingLoan) {
                throw new NotFoundError('Loan not found');
            }

            if (existingLoan.status !== LoanStatus.APPROVED) {
                throw new InvalidStateTransitionError(existingLoan.status, LoanStatus.DISBURSED);
            }

            if (existingLoan.disbursement?.disbursementRef) {
                throw new ConflictError('Loan has already been disbursed');
            }

            throw new AppError('Failed to process disbursement', 500);
        }

        // Get the approved amount (could be different from requested)
        const disbursementAmount = loan.approvalDetails?.approvedAmount || loan.amount;

        // Call payment provider to transfer funds
        const transferResult = await paymentProvider.transfer({
            amount: disbursementAmount,
            accountNumber,
            bankCode,
            narration: `Loan Disbursement - ${loan.applicationNumber}`,
            reference: disbursementRef,
        });

        if (!transferResult.success) {
            // Rollback: Revert status back to approved
            await Loan.findByIdAndUpdate(loanId, {
                status: LoanStatus.APPROVED,
                $unset: { 'disbursement.disbursementRef': 1 },
                $push: {
                    statusHistory: {
                        fromStatus: LoanStatus.DISBURSED,
                        toStatus: LoanStatus.APPROVED,
                        reason: `Disbursement failed: ${transferResult.message}`,
                        performedBy: new mongoose.Types.ObjectId(adminId),
                        timestamp: new Date(),
                    },
                },
            });

            throw new AppError(`Disbursement failed: ${transferResult.message}`, 500);
        }

        // Update loan with provider reference and set to active
        const updatedLoan = await Loan.findByIdAndUpdate(
            loanId,
            {
                status: LoanStatus.ACTIVE,
                'disbursement.amount': disbursementAmount,
                'disbursement.providerReference': transferResult.providerReference,
                $push: {
                    statusHistory: {
                        fromStatus: LoanStatus.DISBURSED,
                        toStatus: LoanStatus.ACTIVE,
                        reason: 'Funds transferred successfully, repayment started',
                        performedBy: new mongoose.Types.ObjectId(adminId),
                        timestamp: new Date(),
                    },
                },
            },
            { new: true }
        );

        // Generate repayment schedule
        await this.generateRepaymentSchedule(updatedLoan!);

        // Create audit log
        await createAuditLog({
            entityType: 'disbursement',
            entityId: loan._id,
            action: 'LOAN_DISBURSED',
            performedBy: new mongoose.Types.ObjectId(adminId),
            newState: {
                disbursementRef,
                amount: disbursementAmount,
                bankAccount: accountNumber,
                providerReference: transferResult.providerReference,
            },
        });

        // Send notification to user
        await notificationService.sendNotification(
            loan.userId,
            NotificationType.LOAN_DISBURSED,
            {
                loanId: loan._id,
                applicationNumber: loan.applicationNumber,
                amount: disbursementAmount,
                reference: disbursementRef,
            }
        );

        return {
            loan: updatedLoan!,
            disbursementRef,
            providerReference: transferResult.providerReference,
            amount: disbursementAmount,
        };
    }

    /**
     * Generate repayment schedule for a disbursed loan
     */
    private async generateRepaymentSchedule(loan: ILoan): Promise<void> {
        const schedules: any[] = [];
        const startDate = new Date();

        // Calculate per-installment amounts
        const totalPrincipal = loan.approvalDetails?.approvedAmount || loan.amount;
        const totalInterest = loan.totalInterest;
        const tenor = loan.tenor;

        const principalPerInstallment = roundToTwoDecimals(totalPrincipal / tenor);
        const interestPerInstallment = roundToTwoDecimals(totalInterest / tenor);
        const totalPerInstallment = roundToTwoDecimals(principalPerInstallment + interestPerInstallment);

        for (let i = 1; i <= tenor; i++) {
            const dueDate = addMonths(startDate, i);

            // Adjust last installment to account for rounding
            let principal = principalPerInstallment;
            let interest = interestPerInstallment;
            let total = totalPerInstallment;

            if (i === tenor) {
                // Last installment gets the remainder
                const paidPrincipal = principalPerInstallment * (tenor - 1);
                const paidInterest = interestPerInstallment * (tenor - 1);
                principal = roundToTwoDecimals(totalPrincipal - paidPrincipal);
                interest = roundToTwoDecimals(totalInterest - paidInterest);
                total = roundToTwoDecimals(principal + interest);
            }

            schedules.push({
                loanId: loan._id,
                installmentNumber: i,
                dueDate,
                principalAmount: principal,
                interestAmount: interest,
                totalAmount: total,
                paidAmount: 0,
                status: ScheduleStatus.PENDING,
            });
        }

        await RepaymentSchedule.insertMany(schedules);
    }

    /**
     * Get disbursement details for a loan
     */
    async getDisbursementDetails(loanId: string): Promise<any> {
        const loan = await Loan.findById(loanId)
            .select('disbursement applicationNumber status')
            .populate('disbursement.disbursedBy', 'firstName lastName email');

        if (!loan) {
            throw new NotFoundError('Loan not found');
        }

        if (!loan.disbursement?.disbursementRef) {
            throw new NotFoundError('Loan has not been disbursed yet');
        }

        return {
            applicationNumber: loan.applicationNumber,
            status: loan.status,
            disbursement: loan.disbursement,
        };
    }
}

export default new DisbursementService();
