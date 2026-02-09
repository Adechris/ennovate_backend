import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
    userId?: string;
    userEmail?: string;
}

class SocketService {
    private io: Server | null = null;
    private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

    /**
     * Initialize Socket.IO server
     */
    initialize(httpServer: HttpServer): Server {
        this.io = new Server(httpServer, {
            cors: {
                origin: process.env.CORS_ORIGIN || '*',
                methods: ['GET', 'POST'],
                credentials: true,
            },
        });

        // Authentication middleware
        this.io.use((socket: AuthenticatedSocket, next) => {
            const token = socket.handshake.auth.token || socket.handshake.query.token;

            if (!token) {
                return next(new Error('Authentication required'));
            }

            try {
                const jwtSecret = process.env.JWT_SECRET;
                if (!jwtSecret) {
                    return next(new Error('Server configuration error'));
                }

                const decoded = jwt.verify(token as string, jwtSecret) as {
                    id: string;
                    email: string;
                };

                socket.userId = decoded.id;
                socket.userEmail = decoded.email;
                next();
            } catch (error) {
                next(new Error('Invalid token'));
            }
        });

        // Connection handler
        this.io.on('connection', (socket: AuthenticatedSocket) => {
            const userId = socket.userId!;

            console.log(`🔌 User connected: ${userId} (socket: ${socket.id})`);

            // Track user's socket connections
            if (!this.userSockets.has(userId)) {
                this.userSockets.set(userId, new Set());
            }
            this.userSockets.get(userId)!.add(socket.id);

            // Join user's personal room
            socket.join(`user:${userId}`);

            // Handle disconnection
            socket.on('disconnect', () => {
                console.log(`🔌 User disconnected: ${userId} (socket: ${socket.id})`);

                const userSocketSet = this.userSockets.get(userId);
                if (userSocketSet) {
                    userSocketSet.delete(socket.id);
                    if (userSocketSet.size === 0) {
                        this.userSockets.delete(userId);
                    }
                }
            });

            // Handle marking notifications as read
            socket.on('notification:read', (notificationId: string) => {
                console.log(`📬 Notification marked as read: ${notificationId}`);
            });

            // Handle marking all as read
            socket.on('notifications:read-all', () => {
                console.log(`📬 All notifications marked as read for user: ${userId}`);
            });
        });

        console.log('✅ Socket.IO initialized');
        return this.io;
    }

    /**
     * Send notification to a specific user
     */
    sendToUser(userId: string, event: string, data: any): void {
        if (!this.io) {
            console.warn('Socket.IO not initialized');
            return;
        }

        this.io.to(`user:${userId}`).emit(event, data);
        console.log(`📤 Sent ${event} to user: ${userId}`);
    }

    /**
     * Send notification to all connected users
     */
    broadcast(event: string, data: any): void {
        if (!this.io) {
            console.warn('Socket.IO not initialized');
            return;
        }

        this.io.emit(event, data);
    }

    /**
     * Check if user is online
     */
    isUserOnline(userId: string): boolean {
        return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
    }

    /**
     * Get number of connected users
     */
    getConnectedUsersCount(): number {
        return this.userSockets.size;
    }

    /**
     * Get the Socket.IO server instance
     */
    getIO(): Server | null {
        return this.io;
    }
}

// Export singleton instance
export const socketService = new SocketService();
