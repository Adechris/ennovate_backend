import mongoose, { Document, Schema } from 'mongoose';

export enum NotificationType {
    LOAN_SUBMITTED = 'loan_submitted',
    LOAN_UNDER_REVIEW = 'loan_under_review',
    LOAN_APPROVED = 'loan_approved',
    LOAN_REJECTED = 'loan_rejected',
    LOAN_DISBURSED = 'loan_disbursed',
    PAYMENT_RECEIVED = 'payment_received',
    PAYMENT_DUE = 'payment_due',
    PAYMENT_OVERDUE = 'payment_overdue',
    LOAN_COMPLETED = 'loan_completed',
    REFUND_PROCESSED = 'refund_processed',
}

export enum NotificationStatus {
    PENDING = 'pending',
    SENT = 'sent',
    FAILED = 'failed',
}

export interface INotification extends Document {
    _id: mongoose.Types.ObjectId;
    userId: mongoose.Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, any>;
    status: NotificationStatus;
    sentAt?: Date;
    readAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            enum: Object.values(NotificationType),
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        data: {
            type: Schema.Types.Mixed,
        },
        status: {
            type: String,
            enum: Object.values(NotificationStatus),
            default: NotificationStatus.PENDING,
        },
        sentAt: {
            type: Date,
        },
        readAt: {
            type: Date,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });
notificationSchema.index({ status: 1 });

const Notification = mongoose.model<INotification>('Notification', notificationSchema);

export default Notification;
