"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setTransaction = exports.getTransactions = void 0;
const Transaction_1 = __importDefault(require("../models/Transaction"));
const Wallet_1 = __importDefault(require("../models/Wallet"));
// @desc    Get all transactions
// @route   GET /api/transactions
// @access  Private
const getTransactions = async (req, res) => {
    const transactions = await Transaction_1.default.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(transactions);
};
exports.getTransactions = getTransactions;
// @desc    Create transaction
// @route   POST /api/transactions
// @access  Private
const setTransaction = async (req, res) => {
    const { amount, type, description } = req.body;
    if (!amount || !type || !description) {
        return res.status(400).json({ message: 'Please add all required fields' });
    }
    if (amount <= 0) {
        return res.status(400).json({ message: 'Amount must be greater than 0' });
    }
    const wallet = await Wallet_1.default.findOne({ user: req.user.id });
    if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found' });
    }
    // Update balance
    if (type === 'deposit') {
        wallet.balance += amount;
    }
    else if (type === 'withdrawal') {
        if (wallet.balance < amount) {
            return res.status(400).json({ message: 'Insufficient funds' });
        }
        wallet.balance -= amount;
    }
    else {
        return res.status(400).json({ message: 'Invalid transaction type' });
    }
    const transaction = await Transaction_1.default.create({
        amount,
        type,
        description,
        user: req.user.id,
    });
    await wallet.save();
    res.status(201).json(transaction);
};
exports.setTransaction = setTransaction;
