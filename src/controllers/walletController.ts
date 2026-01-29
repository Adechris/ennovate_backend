import { Response } from 'express';
import Wallet from '../models/Wallet';

 
export const getWallet = async (req: any, res: Response) => {
    const wallet = await Wallet.findOne({ user: req.user.id });

    if (!wallet) {
        return res.status(404).json({ message: 'Wallet not found' });
    }

    res.status(200).json(wallet);
};
