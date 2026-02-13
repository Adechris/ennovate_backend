import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
    try {
        // Safe debug: Log available environment variable keys (NOT values) in production
        if (process.env.NODE_ENV === 'production') {
            console.log('📋 Available Environment Variables:', Object.keys(process.env).join(', '));
        }

        // Support multiple common environment variable names for MongoDB (Railway, Atlas, etc.)
        const mongoURI = process.env.MONGODB_URI || process.env.DATABASE_URL || process.env.MONGODB_URL || process.env.MONGO_URL;

        if (!mongoURI && process.env.NODE_ENV === 'production') {
            throw new Error('No MongoDB connection string found (tried MONGODB_URI, DATABASE_URL, MONGODB_URL, MONGO_URL). Please check your Railway environment variables.');
        }

        const uri = mongoURI || 'mongodb://localhost:27017/loan_app';
        await mongoose.connect(uri);

        console.log('✅ MongoDB connected successfully');

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️ MongoDB disconnected');
        });

    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
};

export default connectDB;
