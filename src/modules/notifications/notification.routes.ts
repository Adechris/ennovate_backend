import { Router } from 'express';
import notificationService from './notification.service';
import { authenticate } from '../../shared/middleware/auth.middleware';
import { ApiResponse } from '../../shared/utils/api-response';
import { asyncHandler } from '../../shared/middleware/error.middleware';
import { query, param } from 'express-validator';
import { validate } from '../../shared/middleware/validate.middleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: User notifications
 */

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Get user's notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Notifications retrieved
 */
router.get(
    '/',
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('unreadOnly').optional().isBoolean(),
    ],
    validate,
    asyncHandler(async (req, res) => {
        const { page, limit, unreadOnly } = req.query;

        const result = await notificationService.getUserNotifications(
            req.user!._id.toString(),
            {
                page: page ? parseInt(page as string) : 1,
                limit: limit ? parseInt(limit as string) : 20,
                unreadOnly: unreadOnly === 'true',
            }
        );

        ApiResponse.success(res, { notifications: result.notifications }, 'Notifications retrieved', 200, {
            total: result.total,
        });
    })
);

// Get unread count
router.get(
    '/unread-count',
    asyncHandler(async (req, res) => {
        const count = await notificationService.getUnreadCount(
            req.user!._id.toString()
        );

        ApiResponse.success(res, { count }, 'Unread count retrieved');
    })
);

// Mark notification as read
router.patch(
    '/:id/read',
    asyncHandler(async (req, res) => {
        await notificationService.markAsRead(
            req.params.id,
            req.user!._id.toString()
        );

        ApiResponse.success(res, null, 'Notification marked as read');
    })
);

// Mark all as read
router.patch(
    '/read-all',
    asyncHandler(async (req, res) => {
        await notificationService.markAllAsRead(req.user!._id.toString());

        ApiResponse.success(res, null, 'All notifications marked as read');
    })
);

export default router;
