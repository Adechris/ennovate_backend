import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';

 
const generateToken = (id: string) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
        expiresIn: '30d',
    });
};


export const registerUser = async (req: Request, res: Response) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Please add all fields' });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
        return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user: any = await User.create({
        name,
        email,
        password,
    });

    if (user) {
        // Create Wallet for user
        await Wallet.create({
            user: user._id,
            balance: 0,
        });

        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id.toString()),
        });
    } else {
        res.status(400).json({ message: 'Invalid user data' });
    }
};

 
export const loginUser = async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const user: any = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            token: generateToken(user._id.toString()),
        });
    } else {
        res.status(401).json({ message: 'Invalid credentials' });
    }
};

 
export const getMe = async (req: any, res: Response) => {
    res.status(200).json(req.user);
};


export const updateProfile = async (req: any, res: Response) => {
    const user = await User.findById(req.user.id);

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
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};

 
export const deleteAccount = async (req: any, res: Response) => {
    const user = await User.findById(req.user.id);

    if (user) {
        await Wallet.findOneAndDelete({ user: req.user.id });
        await Transaction.deleteMany({ user: req.user.id });
        await user.deleteOne();

        res.json({ message: 'User account deleted' });
    } else {
        res.status(404).json({ message: 'User not found' });
    }
};
