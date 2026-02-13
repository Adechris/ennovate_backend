import mongoose, { Document, Schema, Model } from 'mongoose';
import { InvalidStateTransitionError } from '../../shared/utils/app-error';
import {
    generateApplicationNumber,
    calculateSimpleInterest,
    calculateMonthlyPayment,
    roundToTwoDecimals,
} from '../../shared/utils/helpers';

// Loan status enum
export enum LoanStatus {
    PENDING = 'pending',
    UNDER_REVIEW = 'under_review',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    DISBURSED = 'disbursed',
    ACTIVE = 'active',
    COMPLETED = 'completed',
    DEFAULTED = 'defaulted',
}

// Status change history interface
export interface IStatusChange {
    fromStatus: LoanStatus | null;
    toStatus: LoanStatus;
    reason?: string;
    performedBy: mongoose.Types.ObjectId;
    timestamp: Date;
}

// Approval details interface
export interface IApprovalDetails {
    approvedBy: mongoose.Types.ObjectId;
    approvedAt: Date;
    approvedAmount: number;
    conditions?: string[];
}

// Rejection details interface
export interface IRejectionDetails {
    rejectedBy: mongoose.Types.ObjectId;
    rejectedAt: Date;
    reason: string;
}

// Disbursement details interface
export interface IDisbursementDetails {
    disbursedAt: Date;
    disbursedBy: mongoose.Types.ObjectId;
    disbursementRef: string;
    amount: number;
    bankAccount: string;
    bankCode: string;
    providerReference?: string;
}

// Main loan interface
export interface ILoan extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    applicationNumber: string;

    // Application details
    amount: number;
    tenor: number;
    purpose: string;
    interestRate: number;

    // Calculated fields
    totalInterest: number;
    totalRepayable: number;
    monthlyPayment: number;

    // Status tracking
    status: LoanStatus;
    statusHistory: IStatusChange[];

    // Approval/Rejection
    approvalDetails?: IApprovalDetails;
    rejectionDetails?: IRejectionDetails;

    // Disbursement
    disbursement?: IDisbursementDetails;

    // Bank details for disbursement (provided by user)
    bankDetails?: {
        accountNumber: string;
        bankName: string;
        accountName: string;
        bankCode: string;
    };

    // Balance tracking
    totalRepaid: number;
    outstandingBalance: number;

    createdAt: Date;
    updatedAt: Date;

    // Methods
    transitionTo(
        newStatus: LoanStatus,
        performedBy: mongoose.Types.ObjectId,
        reason?: string
    ): void;
}

// Static methods interface
interface ILoanModel extends Model<ILoan> {
    isValidTransition(fromStatus: LoanStatus, toStatus: LoanStatus): boolean;
}

// Valid state transitions
const VALID_TRANSITIONS: Record<LoanStatus, LoanStatus[]> = {
    [LoanStatus.PENDING]: [LoanStatus.UNDER_REVIEW],
    [LoanStatus.UNDER_REVIEW]: [LoanStatus.APPROVED, LoanStatus.REJECTED],
    [LoanStatus.APPROVED]: [LoanStatus.DISBURSED],
    [LoanStatus.REJECTED]: [], // Terminal state
    [LoanStatus.DISBURSED]: [LoanStatus.ACTIVE],
    [LoanStatus.ACTIVE]: [LoanStatus.COMPLETED, LoanStatus.DEFAULTED],
    [LoanStatus.COMPLETED]: [], // Terminal state
    [LoanStatus.DEFAULTED]: [], // Terminal state
};

const loanSchema = new Schema<ILoan, ILoanModel>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        applicationNumber: {
            type: String,
            unique: true,
        },

        // Application details
        amount: {
            type: Number,
            required: [true, 'Loan amount is required'],
            min: [1000, 'Minimum loan amount is 1000'],
        },
        tenor: {
            type: Number,
            required: [true, 'Loan tenor is required'],
            min: [1, 'Minimum tenor is 1 month'],
            max: [60, 'Maximum tenor is 60 months'],
        },
        purpose: {
            type: String,
            required: [true, 'Loan purpose is required'],
            maxlength: [500, 'Purpose cannot exceed 500 characters'],
        },
        interestRate: {
            type: Number,
            required: true,
            default: 0.15, // 15% annual interest rate
        },

        // Calculated fields
        totalInterest: {
            type: Number,
            default: 0,
        },
        totalRepayable: {
            type: Number,
            default: 0,
        },
        monthlyPayment: {
            type: Number,
            default: 0,
        },

        // Status tracking
        status: {
            type: String,
            enum: Object.values(LoanStatus),
            default: LoanStatus.PENDING,
        },
        statusHistory: [
            {
                fromStatus: {
                    type: String,
                    enum: [...Object.values(LoanStatus), null],
                },
                toStatus: {
                    type: String,
                    enum: Object.values(LoanStatus),
                    required: true,
                },
                reason: String,
                performedBy: {
                    type: Schema.Types.ObjectId,
                    ref: 'User',
                    required: true,
                },
                timestamp: {
                    type: Date,
                    default: Date.now,
                },
            },
        ],

        // Approval details
        approvalDetails: {
            approvedBy: {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
            approvedAt: Date,
            approvedAmount: Number,
            conditions: [String],
        },

        // Rejection details
        rejectionDetails: {
            rejectedBy: {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
            rejectedAt: Date,
            reason: String,
        },

        // Disbursement details
        disbursement: {
            disbursedAt: Date,
            disbursedBy: {
                type: Schema.Types.ObjectId,
                ref: 'User',
            },
            disbursementRef: {
                type: String,
                unique: true,
                sparse: true, // Allow multiple nulls
            },
            amount: Number,
            bankAccount: String,
            bankCode: String,
            providerReference: String,
        },

        // Bank details for disbursement (provided by user)
        bankDetails: {
            accountNumber: String,
            bankName: String,
            accountName: String,
            bankCode: String,
        },

        // Balance tracking
        totalRepaid: {
            type: Number,
            default: 0,
        },
        outstandingBalance: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
        optimisticConcurrency: true, // Enables versioning for concurrency control
    }
);

// Generate application number before saving
loanSchema.pre('save', function (next) {
    if (this.isNew) {
        // Generate application number
        if (!this.applicationNumber) {
            this.applicationNumber = generateApplicationNumber('LN');
        }

        // Calculate loan details
        this.totalInterest = roundToTwoDecimals(
            calculateSimpleInterest(this.amount, this.interestRate, this.tenor)
        );
        this.totalRepayable = roundToTwoDecimals(this.amount + this.totalInterest);
        this.monthlyPayment = roundToTwoDecimals(
            calculateMonthlyPayment(this.totalRepayable, this.tenor)
        );
        this.outstandingBalance = this.totalRepayable;

        // Add initial status to history
        this.statusHistory.push({
            fromStatus: null,
            toStatus: LoanStatus.PENDING,
            performedBy: this.userId,
            timestamp: new Date(),
        });
    }

    next();
});

// Static method to validate state transition
loanSchema.statics.isValidTransition = function (
    fromStatus: LoanStatus,
    toStatus: LoanStatus
): boolean {
    const validNextStates = VALID_TRANSITIONS[fromStatus] || [];
    return validNextStates.includes(toStatus);
};

// Method to transition to a new status
loanSchema.methods.transitionTo = function (
    newStatus: LoanStatus,
    performedBy: mongoose.Types.ObjectId,
    reason?: string
): void {
    const currentStatus = this.status as LoanStatus;
    const validNextStates = VALID_TRANSITIONS[currentStatus];

    if (!validNextStates || !validNextStates.includes(newStatus)) {
        throw new InvalidStateTransitionError(currentStatus, newStatus);
    }

    this.statusHistory.push({
        fromStatus: currentStatus,
        toStatus: newStatus,
        reason,
        performedBy,
        timestamp: new Date(),
    });

    this.status = newStatus;
};

// Indexes
loanSchema.index({ userId: 1, status: 1 });
loanSchema.index({ status: 1 });
loanSchema.index({ createdAt: -1 });

const Loan = mongoose.model<ILoan, ILoanModel>('Loan', loanSchema);

export default Loan;
