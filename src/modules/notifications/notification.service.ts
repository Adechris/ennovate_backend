import mongoose from 'mongoose';
import Notification, {
    NotificationType,
    NotificationStatus,
    INotification,
} from './notification.model';
import { formatCurrency } from '../../shared/utils/helpers';
import { socketService } from '../../shared/services/socket.service';

interface NotificationData {
    loanId?: mongoose.Types.ObjectId;
    applicationNumber?: string;
    amount?: number;
    reference?: string;
    dueDate?: Date;
    reason?: string;
    [key: string]: any;
}

/**
 * Notification Service with real-time Socket.IO delivery
 */
class NotificationService {
    /**
     * Get notification title and message based on type
     */
    private getNotificationContent(
        type: string,
        data: NotificationData
    ): { title: string; message: string } {
        const templates: Record<string, { title: string; message: string }> = {
            [NotificationType.LOAN_SUBMITTED]: {
                title: 'Loan Application Submitted',
                message: `Your loan application ${data.applicationNumber} for ${formatCurrency(data.amount || 0)} has been submitted successfully. We will review it shortly.`,
            },
            [NotificationType.LOAN_UNDER_REVIEW]: {
                title: 'Loan Under Review',
                message: `Your loan application ${data.applicationNumber} is now under review. You will be notified once a decision is made.`,
            },
            [NotificationType.LOAN_APPROVED]: {
                title: 'Loan Approved! 🎉',
                message: `Congratulations! Your loan application ${data.applicationNumber} has been approved for ${formatCurrency(data.amount || 0)}. Disbursement will follow shortly.`,
            },
            [NotificationType.LOAN_REJECTED]: {
                title: 'Loan Application Update',
                message: `We're sorry, your loan application ${data.applicationNumber} was not approved. Reason: ${data.reason || 'Not specified'}. Please contact support for more information.`,
            },
            [NotificationType.LOAN_DISBURSED]: {
                title: 'Loan Disbursed! 💰',
                message: `${formatCurrency(data.amount || 0)} has been disbursed to your account. Reference: ${data.reference}. Your repayment period has started.`,
            },
            [NotificationType.PAYMENT_RECEIVED]: {
                title: data.isAdmin ? 'User Payment Received' : 'Payment Received',
                message: data.isAdmin
                    ? `User ${data.userName} has made a payment of ${formatCurrency(data.amount || 0)} for loan ${data.applicationNumber}.`
                    : `We've received your payment of ${formatCurrency(data.amount || 0)}. Reference: ${data.reference}. Thank you!`,
            },
            [NotificationType.PAYMENT_DUE]: {
                title: 'Payment Reminder',
                message: `Your loan payment of ${formatCurrency(data.amount || 0)} is due on ${data.dueDate?.toLocaleDateString()}. Please ensure timely payment.`,
            },
            [NotificationType.PAYMENT_OVERDUE]: {
                title: 'Payment Overdue ⚠️',
                message: `Your loan payment of ${formatCurrency(data.amount || 0)} is overdue. Please make payment immediately to avoid penalties.`,
            },
            [NotificationType.LOAN_COMPLETED]: {
                title: 'Loan Completed! 🎊',
                message: `Congratulations! You've successfully repaid your loan ${data.applicationNumber}. Thank you for banking with us!`,
            },
            [NotificationType.REFUND_PROCESSED]: {
                title: 'Refund Processed',
                message: `A refund of ${formatCurrency(data.amount || 0)} has been processed. Reference: ${data.reference}.`,
            },
            // Admin-specific notifications
            admin_new_loan_application: {
                title: 'New Loan Application 📝',
                message: `${data.userName} has submitted a loan application for ${formatCurrency(data.amount || 0)}. Application: ${data.applicationNumber}.`,
            },
        };

        return (
            templates[type] || {
                title: 'Notification',
                message: 'You have a new notification.',
            }
        );
    }

    /**
     * Send notification to user with real-time delivery
     */
    async sendNotification(
        userId: mongoose.Types.ObjectId,
        type: string,
        data: NotificationData
    ): Promise<INotification> {
        const { title, message } = this.getNotificationContent(type, data);

        // Save to database
        const notification = await Notification.create({
            userId,
            type,
            title,
            message,
            data,
            status: NotificationStatus.SENT,
            sentAt: new Date(),
        });

        // Send real-time notification via Socket.IO
        const notificationPayload = {
            _id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            createdAt: notification.createdAt,
            read: false,
        };

        socketService.sendToUser(userId.toString(), 'notification', notificationPayload);

        // Log notification
        const isOnline = socketService.isUserOnline(userId.toString());
        console.log('\n📧 ═══════════════════════════════════════════════════');
        console.log(`📧 NOTIFICATION [${type}]`);
        console.log(`📧 To: ${userId} ${isOnline ? '(ONLINE ✓)' : '(OFFLINE)'}`);
        console.log(`📧 Title: ${title}`);
        console.log(`📧 Message: ${message}`);
        console.log('📧 ═══════════════════════════════════════════════════\n');

        return notification;
    }

    /**
     * Get user's notifications
     */
    async getUserNotifications(
        userId: string,
        options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
    ): Promise<{ notifications: any[]; total: number }> {
        const { page = 1, limit = 20, unreadOnly = false } = options;
        const skip = (page - 1) * limit;

        const query: Record<string, any> = { userId };
        if (unreadOnly) {
            query.readAt = null;
        }

        const [notifications, total] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments(query),
        ]);

        return { notifications, total };
    }

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId: string, userId: string): Promise<void> {
        await Notification.findOneAndUpdate(
            { _id: notificationId, userId },
            { readAt: new Date() }
        );

        // Notify client that notification was marked as read
        socketService.sendToUser(userId, 'notification:read', { notificationId });
    }

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(userId: string): Promise<void> {
        await Notification.updateMany(
            { userId, readAt: null },
            { readAt: new Date() }
        );

        // Notify client
        socketService.sendToUser(userId, 'notifications:all-read', {});
    }

    /**
     * Get unread count
     */
    async getUnreadCount(userId: string): Promise<number> {
        return Notification.countDocuments({ userId, readAt: null });
    }

    /**
     * Notify all admin users
     */
    async notifyAllAdmins(type: string, data: NotificationData): Promise<void> {
        // Import User model dynamically to avoid circular dependency
        const User = (await import('../auth/user.model')).default;

        const admins = await User.find({ role: 'admin' });

        for (const admin of admins) {
            await this.sendNotification(admin._id, type, data);
        }

        console.log(`📧 Notified ${admins.length} admin(s) about: ${type}`);
    }
}

export default new NotificationService();
