import mongoose, { Document, Schema } from 'mongoose';

export interface IIdempotencyRecord extends Document {
    key: string;
    endpoint: string;
    method: string;
    statusCode: number;
    responseBody: Record<string, any>;
    userId?: mongoose.Types.ObjectId;
    expiresAt: Date;
    createdAt: Date;
}

const idempotencySchema = new Schema<IIdempotencyRecord>(
    {
        key: {
            type: String,
            required: true,
            unique: true,
        },
        endpoint: {
            type: String,
            required: true,
        },
        method: {
            type: String,
            required: true,
        },
        statusCode: {
            type: Number,
            required: true,
        },
        responseBody: {
            type: Schema.Types.Mixed,
            required: true,
        },
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
        },
        expiresAt: {
            type: Date,
            required: true,
            default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
    },
    {
        timestamps: true,
    }
);

// TTL index - auto-delete expired records
idempotencySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const IdempotencyRecord = mongoose.model<IIdempotencyRecord>(
    'IdempotencyRecord',
    idempotencySchema
);

export default IdempotencyRecord;
