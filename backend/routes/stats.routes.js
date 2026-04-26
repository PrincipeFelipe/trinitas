const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { verifyToken, requireAdmin } = require('../middlewares/auth');

router.get('/', verifyToken, requireAdmin, async (req, res, next) => {
    try {
        // Overall notification stats
        const [[notifStats]] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN status = 'RETURNED' THEN 1 ELSE 0 END) as returned,
                SUM(CASE WHEN assigned_user_id IS NULL THEN 1 ELSE 0 END) as unassigned_count,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'ATTEMPT_1' THEN 1 ELSE 0 END) as attempt1
            FROM notifications
        `);

        // User stats
        const [[userStats]] = await pool.query(`
            SELECT 
                COUNT(*) as total_users,
                SUM(CASE WHEN role = 'REPARTIDOR' THEN 1 ELSE 0 END) as total_couriers
            FROM users
        `);

        // Street stats
        const [[streetStats]] = await pool.query(`
            SELECT 
                COUNT(*) as total_streets,
                (SELECT COUNT(*) FROM demarcations) as assigned_streets
            FROM streets
        `);

        // Calendar: deliveries and attempts per day (last 90 days)
        const [calendarDeliveries] = await pool.query(`
            SELECT 
                DATE_FORMAT(timestamp, '%Y-%m-%d') as day,
                COUNT(*) as attempts,
                SUM(CASE WHEN status_result = 'DELIVERED' THEN 1 ELSE 0 END) as delivered
            FROM delivery_attempts
            WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 90 DAY)
            GROUP BY day
            ORDER BY day ASC
        `);

        // Unassigned notifications detail (first 20)
        const [unassignedNotifs] = await pool.query(`
            SELECT id, recipient_name, full_address, created_at
            FROM notifications
            WHERE assigned_user_id IS NULL AND status NOT IN ('DELIVERED', 'RETURNED')
            ORDER BY created_at ASC
            LIMIT 20
        `);

        // Per-courier effectiveness
        const [courierStats] = await pool.query(`
            SELECT 
                u.name,
                COUNT(DISTINCT n.id) as total_assigned,
                SUM(CASE WHEN n.status = 'DELIVERED' THEN 1 ELSE 0 END) as delivered,
                SUM(CASE WHEN n.status = 'RETURNED' THEN 1 ELSE 0 END) as returned
            FROM users u
            LEFT JOIN notifications n ON n.assigned_user_id = u.id
            WHERE u.role = 'REPARTIDOR'
            GROUP BY u.id, u.name
        `);

        // Urgency breakdown (within 8-day window from created_at)
        const [urgencyStats] = await pool.query(`
            SELECT 
                SUM(CASE WHEN DATEDIFF(NOW(), created_at) BETWEEN 0 AND 2 THEN 1 ELSE 0 END) as safe,
                SUM(CASE WHEN DATEDIFF(NOW(), created_at) BETWEEN 3 AND 4 THEN 1 ELSE 0 END) as warning,
                SUM(CASE WHEN DATEDIFF(NOW(), created_at) >= 5 THEN 1 ELSE 0 END) as critical
            FROM notifications
            WHERE status NOT IN ('DELIVERED', 'RETURNED')
        `);

        res.json({
            success: true,
            data: {
                notifications: {
                    total: notifStats.total || 0,
                    delivered: notifStats.delivered || 0,
                    returned: notifStats.returned || 0,
                    pending: notifStats.pending || 0,
                    attempt1: notifStats.attempt1 || 0,
                    unassigned: notifStats.unassigned_count || 0,
                    deliveryRate: notifStats.total > 0 
                        ? Math.round((notifStats.delivered / notifStats.total) * 100) 
                        : 0
                },
                users: {
                    total: userStats.total_users || 0,
                    couriers: userStats.total_couriers || 0
                },
                streets: {
                    total: streetStats.total_streets || 0,
                    assigned: streetStats.assigned_streets || 0
                },
                calendar: calendarDeliveries,
                unassignedNotifs,
                courierStats,
                urgency: urgencyStats[0] || { safe: 0, warning: 0, critical: 0 }
            }
        });
    } catch (error) {
        next(error);
    }
});

router.get('/activity/:date', verifyToken, requireAdmin, async (req, res, next) => {
    try {
        const { date } = req.params;
        const [rows] = await pool.query(`
            SELECT 
                da.id as attempt_id,
                da.timestamp,
                da.status_result,
                da.notes,
                n.id as notification_id,
                n.recipient_name,
                n.full_address,
                u.name as courier_name
            FROM delivery_attempts da
            JOIN notifications n ON da.notification_id = n.id
            LEFT JOIN users u ON da.delivered_by = u.id
            WHERE DATE(da.timestamp) = ?
            ORDER BY da.timestamp DESC
        `, [date]);

        res.json({ success: true, data: rows });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
