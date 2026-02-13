import mongoose, { Document, Schema } from 'mongoose';

export enum PaymentType {
    REPAYMENT = 'repayment',
    REFUND = 'refund',
    REVERSAL = 'reversal',
}

export enum PaymentStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    SUCCESS = 'success',
    FAILED = 'failed',
}

export interface IPayment extends Document {
    _id: mongoose.Types.ObjectId;
    loanId: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    scheduleId?: mongoose.Types.ObjectId;

    idempotencyKey: string;
    type: PaymentType;
    amount: number;
    reference: string;

    status: PaymentStatus;
    failureReason?: string;

    providerReference?: string;
    providerResponse?: Record<string, any>;

    // Reconciliation
    reconciled: boolean;
    reconciledAt?: Date;

    // Allocation details (for repayments)
    allocation?: {
        principal: number;
        interest: number;
        overpayment: number;
    };

    // Manual Payment Proofs
    proofOfPayment?: string; // Reference or note from the user
    evidenceUrl?: string; // Link to uploaded receipt
    manualProof?: {
        senderBank?: string;
        senderName?: string;
        transferDate?: Date;
        externalReference?: string; // UTR or Reference
    };
    verifiedBy?: mongoose.Types.ObjectId;
    verifiedAt?: Date;
    isOverpaymentRefunded?: boolean;

    createdAt: Date;
    updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
    {
        loanId: {
            type: Schema.Types.ObjectId,
            ref: 'Loan',
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        scheduleId: {
            type: Schema.Types.ObjectId,
            ref: 'RepaymentSchedule',
        },

        idempotencyKey: {
            type: String,
            required: true,
            unique: true,
        },
        type: {
            type: String,
            enum: Object.values(PaymentType),
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        reference: {
            type: String,
            required: true,
            unique: true,
        },

        status: {
            type: String,
            enum: Object.values(PaymentStatus),
            default: PaymentStatus.PENDING,
        },
        failureReason: {
            type: String,
        },

        providerReference: {
            type: String,
        },
        providerResponse: {
            type: Schema.Types.Mixed,
        },

        reconciled: {
            type: Boolean,
            default: false,
        },
        reconciledAt: {
            type: Date,
        },

        allocation: {
            principal: { type: Number, default: 0 },
            interest: { type: Number, default: 0 },
            overpayment: { type: Number, default: 0 },
        },

        // Manual Payment Proofs
        proofOfPayment: { type: String },
        evidenceUrl: { type: String },
        manualProof: {
            senderBank: { type: String },
            senderName: { type: String },
            transferDate: { type: Date },
            externalReference: { type: String },
        },
        isOverpaymentRefunded: { type: Boolean, default: false },
        verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        verifiedAt: { type: Date },
    },
    {
        timestamps: true,
    }
);

// Indexes
paymentSchema.index({ loanId: 1, createdAt: -1 });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ reconciled: 1, status: 1 });

const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;
