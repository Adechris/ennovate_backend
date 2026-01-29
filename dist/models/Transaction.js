"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const transactionSchema = new mongoose_1.default.Schema({
    user: {
        type: mongoose_1.default.Schema.Types.ObjectId,
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
}, {
    timestamps: true,
});
exports.default = mongoose_1.default.model('Transaction', transactionSchema);
