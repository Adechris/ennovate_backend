"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWallet = void 0;
const Wallet_1 = __importDefault(require("../models/Wallet"));
// @desc    Get user wallet
// @route   GET /api/wallet
// @access  Private
const getWallet = async (req, res) => {
    const wallet = await Wallet_1.default.findOne({ user: req.user.id });
    if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found' });
    }
    res.status(200).json(wallet);
};
exports.getWallet = getWallet;
