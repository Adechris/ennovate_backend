import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLogInput {
    entityType: 'loan' | 'payment' | 'user' | 'disbursement';
    entityId: mongoose.Types.ObjectId;
    action: string;
    performedBy: mongoose.Types.ObjectId;
    previousState?: Record<string, any>;
    newState?: Record<string, any>;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
}

export interface IAuditLog extends Document {
    entityType: 'loan' | 'payment' | 'user' | 'disbursement';
    entityId: mongoose.Types.ObjectId;
    action: string;
    performedBy: mongoose.Types.ObjectId;
    previousState?: Record<string, any>;
    newState?: Record<string, any>;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
    {
        entityType: {
            type: String,
            required: true,
            enum: ['loan', 'payment', 'user', 'disbursement'],
        },
        entityId: {
            type: Schema.Types.ObjectId,
            required: true,
            refPath: 'entityType',
        },
        action: {
            type: String,
            required: true,
        },
        performedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        previousState: {
            type: Schema.Types.Mixed,
        },
        newState: {
            type: Schema.Types.Mixed,
        },
        metadata: {
            type: Schema.Types.Mixed,
        },
        ipAddress: {
            type: String,
        },
        userAgent: {
            type: String,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: false,
    }
);

// Indexes for efficient querying
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ performedBy: 1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ action: 1 });

const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

export default AuditLog;

// Helper function to create audit log
export const createAuditLog = async (
    data: IAuditLogInput
): Promise<IAuditLog> => {
    return AuditLog.create(data);
};
