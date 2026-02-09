"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables first
dotenv_1.default.config();
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const database_1 = __importDefault(require("./config/database"));
const socket_service_1 = require("./shared/services/socket.service");
const PORT = process.env.PORT || 5000;
// Connect to database and start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await (0, database_1.default)();
        // Create HTTP server
        const httpServer = http_1.default.createServer(app_1.default);
        // Initialize Socket.IO
        socket_service_1.socketService.initialize(httpServer);
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
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason.message);
    console.error(reason.stack);
    process.exit(1);
});
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
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
