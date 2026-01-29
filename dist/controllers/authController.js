"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAccount = exports.updateProfile = exports.getMe = exports.loginUser = exports.registerUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const Wallet_1 = __importDefault(require("../models/Wallet"));
const Transaction_1 = __importDefault(require("../models/Transaction"));
// Generate JWT
const generateToken = (id) => {
    return jsonwebtoken_1.default.sign({ id }, process.env.JWT_SECRET || 'secret', {
        expiresIn: '30d',
    });
};
// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please add all fields' });
    }
    // Check if user exists
    const userExists = await User_1.default.findOne({ email });
    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }
    // Create user
    const user = await User_1.default.create({
        name,
        email,
        password,
    });
    if (user) {
        // Create Wallet for user
        await Wallet_1.default.create({
            user: user._id,
            balance: 0,
        });
        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id.toString()),
        });
    }
    else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};
exports.registerUser = registerUser;
// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    const { email, password } = req.body;
    // Check for user email
    const user = await User_1.default.findOne({ email }).select('+password');
    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id.toString()),
        });
    }
    else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
};
exports.loginUser = loginUser;
// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    res.status(200).json(req.user);
};
exports.getMe = getMe;
// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
    const user = await User_1.default.findById(req.user.id);
    if (user) {
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        if (req.body.password) {
            user.password = req.body.password;
        }
        const updatedUser = await user.save();
        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            token: generateToken(updatedUser._id.toString()),
        });
    }
    else {
        res.status(404).json({ message: 'User not found' });
    }
};
exports.updateProfile = updateProfile;
// @desc    Delete user account
// @route   DELETE /api/auth/account
// @access  Private
const deleteAccount = async (req, res) => {
    const user = await User_1.default.findById(req.user.id);
    if (user) {
        // Delete wallet and transactions
        await Wallet_1.default.findOneAndDelete({ user: req.user.id });
        await Transaction_1.default.deleteMany({ user: req.user.id });
        await user.deleteOne();
        res.json({ message: 'User account deleted' });
    }
    else {
        res.status(404).json({ message: 'User not found' });
    }
};
exports.deleteAccount = deleteAccount;
