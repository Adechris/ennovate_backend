import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        type: {
            type: String,
            enum: ['deposit', 'withdrawal'],
            required: [true, 'Please specify transaction type'],
        },
        amount: {
            type: Number,
            required: [true, 'Please add an amount'],
        },
        description: {
            type: String,
            required: [true, 'Please add a description'],
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'completed',
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model('Transaction', transactionSchema);
