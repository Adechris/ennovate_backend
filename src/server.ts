import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

import http from 'http';
import app from './app';
import connectDB from './config/database';
import { socketService } from './shared/services/socket.service';

const PORT = process.env.PORT || 5000;

// Connect to database and start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Create HTTP server
        const httpServer = http.createServer(app);

        // Initialize Socket.IO
        socketService.initialize(httpServer);

        // Start server
        httpServer.listen(PORT, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🏦 Loan Application API Server                          ║
║                                                           ║
║   📡 Server running on port ${PORT}                          ║
║   🔌 Socket.IO enabled for real-time notifications        ║
║   🌍 Environment: ${(process.env.NODE_ENV || 'development').padEnd(27)}║
║   📚 API Base: http://localhost:${PORT}/api                  ║
║   ❤️  Health: http://localhost:${PORT}/health                ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
      `);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
    console.error('❌ Unhandled Rejection:', reason.message);
    console.error(reason.stack);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
    console.error('❌ Uncaught Exception:', error.message);
    console.error(error.stack);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('👋 SIGINT received. Shutting down gracefully...');
    process.exit(0);
});

startServer();
