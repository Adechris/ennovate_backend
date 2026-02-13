import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
    try {
        // Safe debug: Log keys related to database to help user verify they are set correctly
        if (process.env.NODE_ENV === 'production') {
            const dbKeys = Object.keys(process.env).filter(k =>
                k.toUpperCase().includes('MONGO') ||
                k.toUpperCase().includes('DATABASE') ||
                k.toUpperCase().includes('URL')
            );
            console.log('🔍 Found Database-related Keys:', dbKeys.join(', '));
        }

        // Search case-insensitively for the connection string
        const findVar = (name: string) => {
            const key = Object.keys(process.env).find(k => k.toUpperCase() === name.toUpperCase());
            return key ? process.env[key] : null;
        };

        const mongoURI = findVar('MONGODB_URI') ||
            findVar('DATABASE_URL') ||
            findVar('MONGODB_URL') ||
            findVar('MONGO_URL');

        if (!mongoURI && process.env.NODE_ENV === 'production') {
            throw new Error(`No MongoDB connection string found. Checked for MONGODB_URI, DATABASE_URL, etc. Available env keys: ${Object.keys(process.env).join(', ')}`);
        }

        const uri = mongoURI || 'mongodb://localhost:27017/loan_app';

        // Log formatted URI (masking password) for verification
        const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');
        console.log(`📡 Attempting to connect to: ${maskedUri}`);

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
