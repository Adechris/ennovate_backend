import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import connectDB from './config/db';
import authRoutes from './routes/authRoutes';
import transactionRoutes from './routes/transactionRoutes';
import walletRoutes from './routes/walletRoutes';

dotenv.config();

connectDB();

const app = express();

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,  
    max: 100, 
    standardHeaders: true, 
    legacyHeaders: false, 
    message: 'Too many requests , try again after 15 minutes'
});

app.use(limiter);
app.use(helmet());
app.use(cors(
    {
        origin: 'http://localhost:5173'
    }
));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/wallet', walletRoutes);
app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
