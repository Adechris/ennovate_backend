import { Response } from 'express';
import Transaction from '../models/Transaction';
import Wallet from '../models/Wallet';

 
export const getTransactions = async (req: any, res: Response) => {
    const transactions = await Transaction.find({ user: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(transactions);
};


export const setTransaction = async (req: any, res: Response) => {
    const { amount, type, description } = req.body;

    if (!amount || !type || !description) {
        return res.status(400).json({ message: 'Please add all required fields' });
    }

    if (amount <= 0) {
        return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    const wallet = await Wallet.findOne({ user: req.user.id });

    if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found' });
    }

    if (type === 'deposit') {
        wallet.balance += amount;
    } else if (type === 'withdrawal') {
        if (wallet.balance < amount) {
            return res.status(400).json({ message: 'Insufficient funds' });
        }
        wallet.balance -= amount;
    } else {
        return res.status(400).json({ message: 'Invalid transaction type' });
    }

    const transaction = await Transaction.create({
        amount,
        type,
        description,
        user: req.user.id,
    });

    await wallet.save();

    res.status(201).json(transaction);
};
