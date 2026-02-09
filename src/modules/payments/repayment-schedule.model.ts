import mongoose, { Document, Schema } from 'mongoose';

export enum ScheduleStatus {
    PENDING = 'pending',
    PARTIAL = 'partial',
    PAID = 'paid',
    OVERDUE = 'overdue',
}

export interface IRepaymentSchedule extends Document {
    _id: mongoose.Types.ObjectId;
    loanId: mongoose.Types.ObjectId;
    installmentNumber: number;
    dueDate: Date;
    principalAmount: number;
    interestAmount: number;
    totalAmount: number;
    paidAmount: number;
    status: ScheduleStatus;
    paidAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const repaymentScheduleSchema = new Schema<IRepaymentSchedule>(
    {
        loanId: {
            type: Schema.Types.ObjectId,
            ref: 'Loan',
            required: true,
        },
        installmentNumber: {
            type: Number,
            required: true,
            min: 1,
        },
        dueDate: {
            type: Date,
            required: true,
        },
        principalAmount: {
            type: Number,
            required: true,
        },
        interestAmount: {
            type: Number,
            required: true,
        },
        totalAmount: {
            type: Number,
            required: true,
        },
        paidAmount: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: Object.values(ScheduleStatus),
            default: ScheduleStatus.PENDING,
        },
        paidAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
repaymentScheduleSchema.index({ loanId: 1, installmentNumber: 1 }, { unique: true });
repaymentScheduleSchema.index({ loanId: 1, status: 1 });
repaymentScheduleSchema.index({ dueDate: 1, status: 1 });

// Virtual to check if overdue
repaymentScheduleSchema.virtual('isOverdue').get(function (this: IRepaymentSchedule) {
    return (
        this.status !== ScheduleStatus.PAID &&
        new Date() > this.dueDate
    );
});

// Method to get remaining amount
repaymentScheduleSchema.methods.getRemainingAmount = function (): number {
    return Math.max(0, this.totalAmount - this.paidAmount);
};

const RepaymentSchedule = mongoose.model<IRepaymentSchedule>(
    'RepaymentSchedule',
    repaymentScheduleSchema
);

export default RepaymentSchedule;
